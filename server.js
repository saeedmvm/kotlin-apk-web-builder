const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(os.tmpdir(), 'kotlin-apk-builder');
fs.mkdirSync(ROOT, { recursive: true });
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  dest: ROOT,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      return cb(new Error('Please upload a .zip Android project.'));
    }
    cb(null, true);
  }
});

function run(command, args, timeoutMs = 8 * 60 * 1000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const append = (chunk) => {
      output += chunk.toString();
      if (output.length > 200000) output = output.slice(-200000);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      output += '\nBUILD TIMED OUT.\n';
      child.kill('SIGTERM');
    }, timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ code: 1, output: output + '\n' + e.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

app.post('/api/build', upload.single('project'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a ZIP file containing an Android Gradle project.' });

  const job = crypto.randomBytes(8).toString('hex');
  const jobDir = path.join(ROOT, job);
  const zipPath = req.file.path;
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    // Docker image includes JDK, Android SDK, Gradle build tools and unzip.
    // Source is mounted only into a disposable container; never run Gradle on the host.
    const copy = await run('docker', [
      'run', '--rm',
      '--network=bridge',
      '--memory=4g', '--cpus=2',
      '--pids-limit=512',
      '-e', 'ANDROID_HOME=/opt/android-sdk',
      '-v', `${zipPath}:/tmp/project.zip:ro`,
      '-v', `${jobDir}:/out`,
      'ghcr.io/cirruslabs/android-sdk:35',
      'bash', '-lc',
      'mkdir -p /work && cd /work && unzip -q /tmp/project.zip && ' +
      'if [ -f gradlew ]; then chmod +x gradlew && ./gradlew --no-daemon assembleDebug; ' +
      'elif [ -f build.gradle ] || [ -f build.gradle.kts ]; then gradle --no-daemon assembleDebug; ' +
      'else echo "Could not find a Gradle Android project at the ZIP root. ZIP should contain the project files, not an extra enclosing folder."; exit 2; fi && ' +
      'find . -type f -path "*/build/outputs/apk/*/*.apk" -exec cp {} /out/app-debug.apk \\;'
    ]);

    const apk = path.join(jobDir, 'app-debug.apk');
    if (copy.code !== 0 || !fs.existsSync(apk)) {
      return res.status(422).json({
        error: 'Build failed. Review the build log below.',
        log: copy.output.slice(-16000)
      });
    }

    // Keep generated artifacts for 30 minutes; simple local cleanup.
    setTimeout(() => fs.rm(jobDir, { recursive: true, force: true }), 30 * 60 * 1000);
    res.json({ success: true, downloadUrl: `/api/download/${job}`, log: copy.output.slice(-12000) });
  } catch (e) {
    res.status(500).json({ error: 'Build service error: ' + e.message });
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
});

app.get('/api/download/:job', (req, res) => {
  if (!/^[a-f0-9]{16}$/.test(req.params.job)) return res.status(400).send('Invalid build ID');
  const apk = path.join(ROOT, req.params.job, 'app-debug.apk');
  if (!fs.existsSync(apk)) return res.status(404).send('APK not found or expired. Run the build again.');
  res.download(apk, 'app-debug.apk');
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Request failed.' });
});

app.listen(PORT, () => console.log(`Kotlin APK Builder running at http://localhost:${PORT}`));
