// © Kay Sievers <kay@vrfy.org>, 2019-2021
// SPDX-License-Identifier: Apache-2.0

// The main menu/navigation.
class V2Web {
  static setup() {
    // Always scroll to the top at page reload.
    history.scrollRestoration = 'manual';

    this.setupMenu();
  }

  static registerWorker(worker) {
    if (!('serviceWorker' in navigator))
      return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register(worker).then(null, () => {});
    });
  }

  static setupMenu() {
    const burger = document.querySelector('.navbar-burger');
    const menu = document.querySelector('.navbar-menu');

    // Toggle menu with burger.
    burger.addEventListener('click', () => {
      burger.classList.toggle('is-active');
      menu.classList.toggle('is-active');
    });

    window.addEventListener('click', (e) => {
      // Do not act on the burger toggle event.
      if (e.target == burger)
        return;

      if (!burger.classList.contains('is-active'))
        return;

      burger.classList.remove('is-active');
      menu.classList.remove('is-active');
    });
  }

  static addNavigation(title, target) {
    const navbar = document.querySelector('.navbar-start');

    this.addElement(navbar, 'a', (e) => {
      e.classList.add('navbar-item');
      e.setAttribute('href', target);
      e.textContent = title;
    });
  }

  static addElement(element, type, handler) {
    const e = document.createElement(type);
    if (handler)
      handler(e);

    element.appendChild(e);
  }

  static addElementAfter(element, type, handler) {
    const e = document.createElement(type);
    if (handler)
      handler(e);

    element.insertAdjacentElement('afterend', e);
  }
}

// Inline element to show a notification with a close button.
class V2WebNotify {
  #element = null;
  #elementText = null;

  constructor(canvas) {
    V2Web.addElement(canvas, 'div', (notify) => {
      this.#element = notify;
      this.#element.style.display = 'none';
      this.#element.classList.add('notification');
      this.#element.classList.add('is-light');

      V2Web.addElement(notify, 'button', (e) => {
        e.classList.add('delete');
        e.addEventListener('click', () => {
          this.clear();
        });
      });

      V2Web.addElement(notify, 'div', (e) => {
        this.#elementText = e;
      });
    });
  }

  clear(text) {
    this.#element.style.display = 'none';
    this.#element.classList.remove('is-info');
    this.#element.classList.remove('is-success');
    this.#element.classList.remove('is-warning');
    this.#element.classList.remove('is-danger');
    this.#elementText.innerHTML = '';
  }

  info(text) {
    this.clear();
    this.#element.classList.add('is-info');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }

  success(text) {
    this.clear();
    this.#element.classList.add('is-success');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }

  warn(text) {
    this.clear();
    this.#element.classList.add('is-warning');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }

  error(text) {
    this.clear();
    this.#element.classList.add('is-danger');
    this.#element.style.display = '';
    this.#elementText.innerHTML = text;
  }
}

// Create a row of buttons and input elements.
class V2WebField {
  #element = null;

  constructor(element, handler) {
    V2Web.addElement(element, 'div', (e) => {
      this.#element = e;
      e.classList.add('field');
      e.classList.add('has-addons');
      if (handler)
        handler(this, e);
    });
  }

  addElement(element, handler) {
    V2Web.addElement(this.#element, 'p', (p) => {
      p.classList.add('control');

      V2Web.addElement(p, element, (e) => {
        if (handler)
          handler(e, p);
      });
    });
  }

  addButton(handler) {
    this.addElement('button', (e, p) => {
      e.classList.add('button');

      if (handler)
        handler(e, p);
    });
  }

  addInput(type, handler) {
    this.addElement('input', (e, p) => {
      e.classList.add('input');
      e.type = type;

      if (handler)
        handler(e, p);
    });
  }
}

class V2WebTabs {
  current = null;

  #element = null;
  #elementsTabs = null;
  #tabs = {};
  #notifiers = [];

  constructor(element, handler) {
    this.#element = element;

    V2Web.addElement(element, 'div', (e) => {
      e.classList.add('tabs');
      e.classList.add('is-centered');
      e.classList.add('is-fullwidth');
      e.classList.add('is-boxed');

      V2Web.addElement(e, 'ul', (ul) => {
        this.#elementsTabs = ul;
      });
    });

    if (handler)
      handler(this);
  }

  addNotifier(handler) {
    this.#notifiers.push(handler);
  }

  addTab(name, text, handler) {
    this.#tabs[name] = {};

    V2Web.addElement(this.#elementsTabs, 'li', (e) => {
      e.addEventListener('click', () => {
        // Do not switch inactive tabs.
        if (!this.current)
          return;

        this.switchTab(name);
      });

      V2Web.addElement(e, 'a', (e) => {
        e.textContent = text;
      });

      this.#tabs[name].tab = e;
    });

    V2Web.addElement(this.#element, 'div', (e) => {
      if (handler)
        handler(e);

      e.style.display = 'none';
      this.#tabs[name].canvas = e;
    });
  }

  switchTab(name) {
    for (const id of Object.keys(this.#tabs)) {
      if (id == name) {
        this.#tabs[id].tab.classList.add('is-active');
        this.#tabs[id].canvas.style.display = '';

      } else {
        this.#tabs[id].tab.classList.remove('is-active');
        this.#tabs[id].canvas.style.display = 'none';
      }
    }

    this.current = name;

    for (const notifier of this.#notifiers)
      notifier(name);
  }

  // Clear the tab's content.
  resetTab(name) {
    const canvas = this.#tabs[name].canvas;
    while (canvas.firstChild)
      canvas.firstChild.remove();
  }
}

class V2WebModule {
  canvas = null;

  #section = null;
  #id = null;
  #title = null;

  constructor(id, title, subtitle) {
    this.#id = id;
    this.#title = title;

    this.#section = document.createElement('section');
    if (this.#id)
      this.#section.id = id;

    V2Web.addElement(this.#section, 'div', (container) => {
      container.classList.add('container');

      if (title) {
        V2Web.addElement(container, 'h2', (e) => {
          e.classList.add('title');
          e.textContent = title;
        });

        V2Web.addElement(container, 'p', (e) => {
          e.classList.add('subtitle');
          e.textContent = subtitle;
        });
      }

      V2Web.addElement(container, 'div', (e) => {
        this.canvas = e;
      });
    });
  }

  // Separate attach() to allow early initialization, but allow control over the
  // order of appearance of the modules.
  attach() {
    if (this.#id)
      V2Web.addNavigation(this.#title, '#' + this.#id);

    document.body.appendChild(this.#section);
  }

  // Clear all content.
  reset() {
    while (this.canvas.firstChild)
      this.canvas.firstChild.remove();
  }
}
