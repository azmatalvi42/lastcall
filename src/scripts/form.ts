// Tiny progressive enhancement for the walkthrough form.
// Without JavaScript the form still posts normally and the server redirects
// back to /#thanks or /#form-error.
import { uploadLimits, tooLargeMessage } from '../config/site';

const form = document.querySelector<HTMLFormElement>('form[data-walkthrough]');

if (form) {
  const started = form.querySelector<HTMLInputElement>('input[name="started"]')!;
  started.value = String(Date.now());

  const photosInput = form.querySelector<HTMLInputElement>('#f-photos')!;
  const photoStatus = document.getElementById('photo-status')!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const thanks = document.getElementById('thanks')!;
  const formError = document.getElementById('form-error')!;
  const tooLargeState = document.getElementById('too-large');
  // Room for the text fields and multipart boundaries on top of the photos.
  const OVERHEAD_BYTES = 64 * 1024;
  const fields = ['name', 'phone', 'region', 'timeline', 'photos'];

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

  function setError(field: string, msg: string | null) {
    const el = document.getElementById(`e-${field}`);
    const wrap = el?.closest('.field');
    const input = form!.querySelector<HTMLElement>(`[name="${field}"]`);
    if (!el) return;
    el.textContent = msg ?? '';
    el.hidden = !msg;
    if (msg) {
      wrap?.setAttribute('data-invalid', '');
      input?.setAttribute('aria-invalid', 'true');
      input?.setAttribute('aria-describedby', `e-${field}`);
    } else {
      wrap?.removeAttribute('data-invalid');
      input?.removeAttribute('aria-invalid');
      input?.removeAttribute('aria-describedby');
    }
  }

  async function resize(file: File): Promise<Blob> {
    if (!file.type.startsWith('image/')) return file;
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, uploadLimits.maxEdgePx / Math.max(bmp.width, bmp.height));
      const w = Math.round(bmp.width * scale);
      const h = Math.round(bmp.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
      return blob && blob.size < file.size ? blob : file;
    } catch {
      return file; // e.g. HEIC on browsers that cannot decode it
    }
  }

  photosInput.addEventListener('change', () => {
    const files = Array.from(photosInput.files ?? []);
    setError('photos', null);
    if (files.length > uploadLimits.maxFiles) {
      setError('photos', `Please choose ${uploadLimits.maxFiles} photos or fewer.`);
      photoStatus.textContent = '';
      return;
    }
    photoStatus.textContent = files.length
      ? `${files.length} photo${files.length > 1 ? 's' : ''} chosen. Large photos are made smaller before sending.`
      : '';
  });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    fields.forEach((f) => setError(f, null));
    setError('form', null);

    const data = new FormData(form);
    const files = Array.from(photosInput.files ?? []).filter((f) => f.size > 0);
    if (files.length > uploadLimits.maxFiles) {
      setError('photos', `Please choose ${uploadLimits.maxFiles} photos or fewer.`);
      photosInput.focus();
      return;
    }

    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = files.length ? 'Preparing photos...' : 'Sending...';

    try {
      data.delete('photos');
      let total = 0;
      for (const [i, f] of files.entries()) {
        const blob = await resize(f);
        total += blob.size;
        const name = (f.name.replace(/\.[^.]+$/, '') || `photo-${i + 1}`) + (blob.type === 'image/jpeg' ? '.jpg' : '');
        data.append('photos', blob, blob === f ? f.name : name);
      }
      if (total > uploadLimits.maxTotalBytes || total + OVERHEAD_BYTES > uploadLimits.maxRequestBytes) {
        setError('photos', `${tooLargeMessage} (These add up to ${mb(total)} MB; the limit is ${mb(uploadLimits.maxRequestBytes)} MB.)`);
        photosInput.focus();
        return;
      }

      submit.textContent = 'Sending...';
      const res = await fetch(form.action, { method: 'POST', body: data, headers: { accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      if (res.status === 413) {
        // Our function's JSON 413, or the platform's own limit page: same message either way.
        setError('photos', body.errors?.photos ?? tooLargeMessage);
        photosInput.focus();
        return;
      }
      if (res.ok && body.ok) {
        document.getElementById('demo-note')!.hidden = !body.demo;
        formError.removeAttribute('data-show');
        tooLargeState?.removeAttribute('data-show');
        thanks.setAttribute('data-show', '');
        thanks.focus();
        return;
      }
      const errors: Record<string, string> = body.errors ?? { form: 'Sorry, something went wrong. Please try again or call us.' };
      let first: string | null = null;
      for (const [k, v] of Object.entries(errors)) {
        if (fields.includes(k)) {
          setError(k, v);
          first ??= k;
        } else setError('form', v);
      }
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    } catch {
      setError('form', 'We could not reach the server. Please check your connection, or call us.');
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
