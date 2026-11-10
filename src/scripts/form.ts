// The lead form. Each input filled brings up the next scene of the selling
// process beside it: listing, bidding, payment, pickup. Without JavaScript the
// forms still post normally and the server redirects back to /#thanks or /#form-error.
import { mountSaleScenes } from './sale-scenes';

const form = document.querySelector<HTMLFormElement>('form[data-walkthrough]');
const formArea = document.querySelector<HTMLElement>('[data-capture-form]');
const thanks = document.getElementById('thanks');
const demoNote = document.getElementById('demo-note');
const scenesRoot = document.querySelector<HTMLElement>('[data-sale-scenes]');
const scenes = scenesRoot ? mountSaleScenes(scenesRoot) : null;

document.querySelectorAll<HTMLInputElement>('input[name="started"]').forEach((input) => {
  input.value = String(Date.now());
});

type Reply = { ok: boolean; demo?: boolean; errors?: Record<string, string> };

async function post(target: HTMLFormElement, data: FormData): Promise<Reply> {
  const res = await fetch(target.action, { method: 'POST', body: data, headers: { accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && Boolean(body.ok), demo: body.demo, errors: body.errors };
}

/** Moves to the form the same way a link to it does, so the page's section changer stays in charge. */
if (form) {
  const fieldNames = ['name', 'email', 'phone', 'location'];
  const input = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;

  // The browser's bubbles are for when there is no JavaScript. Here errors sit under each line.
  form.noValidate = true;

  const isFilled: Record<string, (el: HTMLInputElement) => boolean> = {
    name: (el) => el.value.trim().length >= 2,
    email: (el) => el.value.trim() !== '' && el.validity.valid,
    phone: (el) => el.value.replace(/\D/g, '').length >= 10,
    location: (el) => el.value.trim().length >= 2,
  };

  let reached = 0;
  const syncScenes = () => {
    const filled = fieldNames.filter((name) => {
      const done = isFilled[name](input(name));
      input(name).closest('.capture-row')?.classList.toggle('is-filled', done);
      return done;
    }).length;
    if (filled !== reached) scenes?.goTo(filled);
    reached = filled;
  };

  function setError(field: string, message: string | null) {
    const el = document.getElementById(`e-${field}`);
    if (!el) return;
    el.textContent = message ?? '';
    el.hidden = !message;
    if (field === 'form') return;
    const control = input(field);
    if (message) {
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', `e-${field}`);
    } else {
      control.removeAttribute('aria-invalid');
      control.removeAttribute('aria-describedby');
    }
  }

  // Autofill does not always send `input`, so `change` is covered too.
  ['input', 'change'].forEach((type) => form.addEventListener(type, (event) => {
    const name = (event.target as HTMLInputElement).name;
    if (fieldNames.includes(name)) setError(name, null);
    setError('form', null);
    syncScenes();
  }));

  function showThanks() {
    if (formArea) formArea.hidden = true;
    thanks?.setAttribute('data-show', '');
    thanks?.focus({ preventScroll: true });
    scenes?.finish();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    fieldNames.forEach((name) => setError(name, null));
    setError('form', null);

    const missing: Record<string, string> = {};
    if (input('name').value.trim().length < 2) missing.name = 'Please tell us your name.';
    if (!isFilled.email(input('email'))) missing.email = input('email').value.trim() ? 'Please enter a valid email address.' : 'Please enter your email.';

    const report = (errors: Record<string, string>) => {
      let first: string | null = null;
      for (const [key, message] of Object.entries(errors)) {
        if (fieldNames.includes(key)) {
          setError(key, message);
          first ??= key;
        } else setError('form', message);
      }
      if (first) input(first).focus();
    };

    if (Object.keys(missing).length) {
      report(missing);
      return;
    }

    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Sending...';
    try {
      const reply = await post(form, new FormData(form));
      if (reply.ok) {
        if (demoNote) demoNote.hidden = !reply.demo;
        showThanks();
        return;
      }
      report(reply.errors ?? { form: 'Sorry, something went wrong. Please try again or call us.' });
    } catch {
      setError('form', 'We could not reach the server. Please check your connection, or call us.');
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
