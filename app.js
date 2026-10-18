const form = document.getElementById('buildForm');
const button = document.getElementById('buildButton');
const statusBox = document.getElementById('status');
const result = document.getElementById('result');
const logBox = document.getElementById('log');
const download = document.getElementById('download');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = document.getElementById('project').files[0];
  if (!file) {
    statusBox.textContent = 'ابتدا فایل ZIP پروژه را انتخاب کنید.';
    return;
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    statusBox.textContent = 'فقط فایل ZIP پذیرفته می‌شود.';
    return;
  }

  button.disabled = true;
  button.textContent = 'در حال ساخت…';
  result.hidden = true;
  statusBox.textContent = 'پروژه ارسال شد. کامپایل ممکن است چند دقیقه طول بکشد.';
  const data = new FormData();
  data.append('project', file);

  try {
    const response = await fetch('/api/build', { method: 'POST', body: data });
    const body = await response.json();
    logBox.textContent = body.log || body.error || 'گزارشی دریافت نشد.';
    result.hidden = false;
    if (response.ok && body.success) {
      statusBox.textContent = 'ساخت با موفقیت انجام شد.';
      download.href = body.downloadUrl;
      download.hidden = false;
    } else {
      statusBox.textContent = body.error || 'ساخت ناموفق بود.';
      download.hidden = true;
    }
  } catch (error) {
    statusBox.textContent = 'ارتباط با سرور برقرار نشد. مطمئن شوید سرور اجراست و Docker نصب شده است.';
    logBox.textContent = String(error);
    result.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'ساخت APK';
  }
});
