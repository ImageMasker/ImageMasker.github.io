// A small form in a Modal: a few text fields and a confirm button. Resolves to the values, or
// null when it is closed without confirming.

import { el } from '../utils/dom.js';
import { button, row } from './kit.js';
import { Modal } from './Modal.js';

export function promptDialog(host, { title, intro = '', fields, confirm = 'OK' }) {
  return new Promise((resolve) => {
    let done = false;
    const inputs = fields.map((field) =>
      el('input', {
        type: 'text',
        value: field.value ?? '',
        placeholder: field.placeholder ?? '',
        maxlength: String(field.max ?? 60),
        'aria-label': field.label,
      })
    );
    const finish = (values) => {
      if (done) {
        return;
      }

      done = true;
      modal.close();
      modal.element.remove();
      resolve(values);
    };
    const submit = () => {
      const values = Object.fromEntries(fields.map((field, index) => [field.key, inputs[index].value.trim()]));
      const missing = fields.findIndex((field, index) => field.required && !inputs[index].value.trim());

      if (missing >= 0) {
        inputs[missing].focus();
        return;
      }

      finish(values);
    };
    const modal = new Modal({ title, intro, className: 'prompt-modal', onClose: () => finish(null) });

    inputs.forEach((input) => input.addEventListener('keydown', (event) => event.key === 'Enter' && submit()));
    modal.body.append(
      el('div', { className: 'stack' }, [
        ...fields.map((field, index) =>
          el('label', { className: 'field' }, [el('span', { className: 'field-label', textContent: field.label }), inputs[index]])
        ),
        row([button(confirm, { className: 'app-button--primary', onClick: submit })], 'button-row--fill'),
      ])
    );
    host.append(modal.element);
    modal.open();
    inputs[0]?.focus();
    inputs[0]?.select();
  });
}
