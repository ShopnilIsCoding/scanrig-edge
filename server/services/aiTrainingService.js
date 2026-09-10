import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import TrainingSample from '../models/TrainingSample.js';
import ExerciseDefinition from '../models/ExerciseDefinition.js';

const job = {
  running: false,
  stage: 'idle',
  startedAt: null,
  completedAt: null,
  error: '',
  logs: [],
  realSamples: 0,
  modelVersion: null,
};

function aiDir() {
  return path.resolve(process.env.AI_TRAINING_DIR || '../scanrig-ai');
}

function isGenericPythonCommand(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized || ['python', 'python.exe', 'python3', 'py'].includes(normalized);
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function resolvePythonInterpreter(cwd) {
  const configured = String(process.env.PYTHON_BIN || '').trim();

  // A real explicitly configured path wins when it exists.
  if (configured && !isGenericPythonCommand(configured)) {
    const configuredPath = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
    if (await fileExists(configuredPath)) {
      return configuredPath;
    }
    pushLog(`Configured PYTHON_BIN was not found: ${configuredPath}`);
  }

  // Prefer the AI package's own environment. This is the environment created
  // by setup_windows.ps1 and is where TensorFlow/ONNX are installed.
  const localCandidates = process.platform === 'win32'
    ? [
        path.join(cwd, '.venv', 'Scripts', 'python.exe'),
        path.join(cwd, 'venv', 'Scripts', 'python.exe'),
      ]
    : [
        path.join(cwd, '.venv', 'bin', 'python'),
        path.join(cwd, 'venv', 'bin', 'python'),
      ];

  for (const candidate of localCandidates) {
    if (await fileExists(candidate)) return candidate;
  }

  // If the admin deliberately supplied a command such as python3, honor it
  // only after checking the local project environments.
  if (configured) return configured;

  return process.platform === 'win32' ? 'python' : 'python3';
}

async function verifyPythonEnvironment(python, cwd) {
  return new Promise((resolve, reject) => {
    const code = [
      'import sys',
      'import tensorflow as tf',
      'import onnx',
      'import onnxruntime as ort',
      'print("PYTHON=" + sys.executable)',
      'print("TENSORFLOW=" + tf.__version__)',
      'print("ONNX=" + onnx.__version__)',
      'print("ONNXRUNTIME=" + ort.__version__)',
    ].join('; ');

    pushLog(`Checking AI Python environment: ${python}`);
    const child = spawn(python, ['-c', code], {
      cwd,
      env: process.env,
      shell: false,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });

    child.on('error', (error) => {
      reject(new Error(
        `Could not launch the ScanRig AI Python interpreter (${python}): ${error.message}`
      ));
    });

    child.on('close', (exitCode) => {
      stdout.split(/\r?\n/).forEach(pushLog);

      // TensorFlow writes normal CPU/oneDNN information to stderr. Only add
      // the tail to job logs if verification actually failed.
      if (exitCode !== 0) {
        const usefulError = stderr
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(-8)
          .join(' | ');

        reject(new Error(
          `The selected Python interpreter cannot load the ScanRig AI environment. ` +
          `Expected TensorFlow/ONNX in scanrig-ai/.venv. Interpreter: ${python}` +
          (usefulError ? ` | ${usefulError}` : '')
        ));
        return;
      }

      resolve();
    });
  });
}

function pushLog(line) {
  const clean = String(line || '').trim();
  if (!clean) return;
  job.logs = [...job.logs.slice(-79), clean];
  console.log(`[ScanRig AI] ${clean}`);
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    pushLog(`$ ${command} ${args.join(' ')}`);
    const child = spawn(command, args, { cwd, env: process.env, shell: false });
    child.stdout.on('data', (chunk) => String(chunk).split(/\r?\n/).forEach(pushLog));
    child.stderr.on('data', (chunk) => String(chunk).split(/\r?\n/).forEach(pushLog));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function exportRealSamples(targetFile) {
  const items = await TrainingSample.find({ status: 'approved' }).sort({ capturedAt: 1 }).lean();
  const recordings = items.map((item) => ({
    schemaVersion: 1,
    recordingId: item.recordingId,
    sessionId: item.sessionId,
    label: item.label,
    participantName: item.participantName || item.participantId || 'Unknown trainer',
    participantGender: item.participantGender || 'other',
    trainerPersona: item.trainerPersona || 'james',
    participantId: item.participantName || item.participantId || 'Unknown trainer',
    cameraView: item.cameraView,
    notes: item.notes,
    capturedAt: item.capturedAt,
    sequenceLength: item.sequenceLength,
    featureCount: item.featureCount,
    sampleHz: item.sampleHz,
    frames: item.frames,
    source: item.source || 'admin-real',
    status: item.status,
  }));
  await fs.mkdir(path.dirname(targetFile), { recursive: true });
  await fs.writeFile(targetFile, JSON.stringify({ schemaVersion: 1, createdAt: new Date().toISOString(), recordings }));
  return recordings.length;
}


async function markCustomClassesTrained(cwd, version) {
  try {
    const labelsFile = path.join(cwd, 'artifacts', 'labels.json');
    const labels = JSON.parse(await fs.readFile(labelsFile, 'utf8'));
    const custom = await ExerciseDefinition.find({ id: { $in: labels } });
    for (const exercise of custom) {
      const approved = await TrainingSample.countDocuments({ label: exercise.id, status: 'approved' });
      exercise.trainedAt = new Date();
      exercise.trainedSampleCount = approved;
      exercise.trainedModelVersion = version;
      await exercise.save();
    }
    if (custom.length) pushLog(`Marked ${custom.length} custom exercise class${custom.length === 1 ? '' : 'es'} as trained.`);
  } catch (error) {
    pushLog(`Training metadata warning: ${error.message}`);
  }
}

export function getTrainingJob() {
  return { ...job, logs: [...job.logs] };
}

export function getModelDirectory() {
  return path.join(aiDir(), 'web_model');
}

async function readJsonIfPresent(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function getModelStatus() {
  const directory = getModelDirectory();
  const modelFile = path.join(directory, 'model.onnx');
  const runtime = await readJsonIfPresent(path.join(directory, 'runtime.json'));
  const meta = await readJsonIfPresent(path.join(directory, 'model_meta.json'));
  const labelsPayload = await readJsonIfPresent(path.join(directory, 'labels.json'));
  let stat = null;
  try { stat = await fs.stat(modelFile); } catch { /* model not exported yet */ }
  const labels = Array.isArray(labelsPayload) ? labelsPayload : (labelsPayload?.labels || meta?.classes || []);
  return {
    installed: Boolean(stat && runtime),
    format: runtime?.format || 'onnx',
    runtime: runtime?.runtime || 'onnxruntime-web',
    modelVersion: runtime?.modelVersion || null,
    exportedAt: runtime?.exportedAt || null,
    modelBytes: stat?.size || 0,
    inputShape: runtime?.inputShape || null,
    maxParityDifference: runtime?.maxParityDifference ?? null,
    labels,
    classCount: labels.length,
    testAccuracy: meta?.testAccuracy ?? null,
    splitMode: meta?.splitMode || null,
    datasetSamples: meta?.datasetSamples ?? null,
    sourceCounts: meta?.sourceCounts || {},
    trainedAt: meta?.trainedAt || null,
  };
}

export async function startTrainingJob() {
  if (job.running) return getTrainingJob();

  job.running = true;
  job.stage = 'preparing';
  job.startedAt = new Date().toISOString();
  job.completedAt = null;
  job.error = '';
  job.logs = [];
  job.realSamples = 0;

  const cwd = aiDir();
  const python = await resolvePythonInterpreter(cwd);
  const epochs = String(Number(process.env.AI_TRAINING_EPOCHS || 60));
  const rawFile = path.join(cwd, 'data', 'raw', 'admin-live.json');
  const realFile = path.join(cwd, 'data', 'processed', 'scanrig_real.npz');
  const syntheticFile = path.join(cwd, 'data', 'processed', 'scanrig_synthetic.npz');
  const combinedFile = path.join(cwd, 'data', 'processed', 'scanrig_combined.npz');

  (async () => {
    try {
      await fs.access(path.join(cwd, 'train.py'));
      await fs.access(syntheticFile);

      job.stage = 'checking-python';
      pushLog(`Using AI directory: ${cwd}`);
      pushLog(`Using Python interpreter: ${python}`);
      await verifyPythonEnvironment(python, cwd);

      job.stage = 'exporting-real-data';
      job.realSamples = await exportRealSamples(rawFile);
      pushLog(`Exported ${job.realSamples} real samples from MongoDB.`);

      if (job.realSamples > 0) {
        job.stage = 'preparing-real-data';
        await run(python, ['prepare_dataset.py', '--input', rawFile, '--output', realFile], cwd);
      } else {
        await fs.rm(realFile, { force: true }).catch(() => {});
        pushLog('No real samples yet; training from the synthetic base only.');
      }

      job.stage = 'merging-datasets';
      await run(python, ['merge_datasets.py', '--synthetic', syntheticFile, '--real', realFile, '--output', combinedFile], cwd);

      job.stage = 'training';
      await run(python, ['train.py', '--data', combinedFile, '--epochs', epochs], cwd);

      job.stage = 'exporting-onnx-model';
      await run(python, ['export_onnx.py'], cwd);

      job.completedAt = new Date().toISOString();
      const modelStatus = await getModelStatus();
      job.modelVersion = modelStatus.modelVersion;
      await markCustomClassesTrained(cwd, job.modelVersion || job.completedAt);
      job.stage = 'ready';
      pushLog(`Training complete. ONNX model ${job.modelVersion || 'latest'} is ready and will hot-reload in the frontend.`);
    } catch (error) {
      job.stage = 'failed';
      job.error = error.message;
      job.completedAt = new Date().toISOString();
      pushLog(`FAILED: ${error.message}`);
    } finally {
      job.running = false;
    }
  })();

  return getTrainingJob();
}
