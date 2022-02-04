// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

class V2SettingsModule {
  device = null;
  settings = null;
  setting = null;

  constructor(device, settings, setting) {
    this.device = device;
    this.settings = settings;
    this.setting = setting;

    return Object.seal(this);
  }

  addTitle(canvas, text) {
    V2Web.addElement(canvas, 'h3', (e) => {
      e.classList.add('title');
      e.classList.add('subsection');
      e.textContent = text;
    });
  }

  // Access nested property; the path elements are separated by '/': 'devices[4]/name'.
  setConfiguration(data, value) {
    // Split at '/', and convert array indices to distinct path elements.
    const path = this.setting.path.replaceAll('[', '/').replaceAll(']', '').split('/');

    let object = data
    for (let i = 0; i < path.length; i++) {
      const element = path[i];

      if (value != undefined) {
        // Assign the value to the last element.
        if (i == path.length - 1)
          object[element] = value;

        // Create path; add empty array if the next element is an index.
        else if (object[element] == undefined)
          object[element] = (path[i + 1].match(/^[0-9]+$/)) ? [] : {};
      }

      object = object[element];
    }

    return object;
  }

  getConfiguration(data) {
    return this.setConfiguration(data);
  }
}

// The chromatic note calibration. Every note defines the the raw
// velociy values to play the velocities 1 and 127.
// The raw values are played by switching to a specific MIDI program.
class V2SettingsCalibration extends V2SettingsModule {
  static type = 'calibration';

  #device = null;
  #settings = null;
  #currentProgram = Object.seal({
    bank: 0,
    number: 0
  });
  #values = null;
  #playTimer = null;
  #notes = Object.seal({
    element: null,
    bank: 0,
    program: 0
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addTitle(canvas, 'Calibration');

    // Find current program.
    if (data.input.programs) {
      data.input.programs.find((program) => {
        if (!program.selected)
          return false;

        this.#currentProgram.bank = program.bank;
        this.#currentProgram.number = program.number;
        return true;
      });
    }

    if (setting.program != null) {
      this.#notes.bank = setting.program.bank;
      this.#notes.program = setting.program.number;
    }

    const changeProgram = (program, bank) => {
      const msb = (bank >> 7) & 0x7f;
      const lsb = bank & 0x7f;
      this.device.sendControlChange(0, V2MIDI.CC.bankSelect, msb);
      this.device.sendControlChange(0, V2MIDI.CC.bankSelectLSB, lsb);
      this.device.sendProgramChange(0, program);
    };

    const playAll = (field) => {
      const reset = () => {
        clearInterval(this.#playTimer);
        this.#playTimer = null;
        changeProgram(this.#currentProgram.number, this.#currentProgram.bank);
      }

      if (this.#playTimer) {
        reset();
        return;
      }

      changeProgram(this.#notes.program, this.#notes.bank);

      let index = 0;
      this.#playTimer = setInterval(() => {
        const note = index + this.setting.chromatic.start;
        const velocity = this.#values[index][field];
        this.device.sendNote(0, note, velocity);

        index++;
        if (index == this.#values.length)
          reset();
      }, 150);
    }

    const playNote = (note, velocity) => {
      changeProgram(this.#notes.program, this.#notes.bank);
      this.device.sendNote(0, note, velocity);
      changeProgram(this.#currentProgram.number, this.#currentProgram.bank);
    }

    V2Web.addButtons(canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Play Min';
        e.addEventListener('click', () => {
          playAll('min');
        });
      });

      V2Web.addButton(buttons, (e) => {
        e.textContent = 'Play Max';
        e.addEventListener('click', () => {
          playAll('max');
        });
      });
    });

    const addCalibrationNote = (i, note) => {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = V2MIDI.Note.name(note);
          e.classList.add(V2MIDI.Note.isBlack(note) ? 'is-dark' : 'has-background-grey-lighter');
        });

        field.addButton((e) => {
          e.textContent = 'Min';
          e.addEventListener('mousedown', () => {
            playNote(note, this.#values[i].min);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].min;
          e.addEventListener('change', () => {
            this.#values[i].min = e.value
            playNote(note, this.#values[i].min);
          });
        });

        field.addButton((e) => {
          e.textContent = 'Max';
          e.addEventListener('mousedown', () => {
            playNote(note, this.#values[i].max);
          });
        });

        field.addInput('number', (e) => {
          e.classList.add('width-number');
          e.min = 1;
          e.max = 127;
          e.value = this.#values[i].max;
          e.addEventListener('change', () => {
            this.#values[i].max = e.value;
            playNote(note, this.#values[i].max);
          });
        });
      });
    }

    const calibration = this.getConfiguration(data.configuration);
    this.#values = [];
    for (let i = 0; i < this.setting.chromatic.count; i++) {
      this.#values.push({
        'min': calibration[i].min,
        'max': calibration[i].max
      });
    }

    for (let i = 0; i < this.setting.chromatic.count; i++)
      addCalibrationNote(i, this.setting.chromatic.start + i);

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#values);
  }

  clear() {
    if (this.#playTimer) {
      clearInterval(this.#playTimer);
      this.#playTimer = null;
    }
  }
}

// HSV color configuration.
class V2SettingsColor extends V2SettingsModule {
  static type = 'color';

  #color = Object.seal({
    element: null,
    h: 0,
    s: 0,
    v: 0
  });
  #hue = null;
  #saturation = null;
  #brightness = null;
  #configuration = null;

  #updateColor() {
    // Convert HSV to HSL.
    let s = 0;
    let l = this.#color.v * (1 - this.#color.s / 2);
    if (l > 0 && l < 1)
      s = (this.#color.v - l) / (l < 0.5 ? l : 1 - l);

    this.#color.element.style.backgroundColor = 'hsl(' + this.#color.h + ', ' + (s * 100) + '%, ' + (l * 100) + '%)';
  };

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    this.#configuration = setting.configuration;
    V2Web.addButtons(canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = 'Color';
      });

      V2Web.addButton(buttons, (e) => {
        this.#color.element = e;
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });
    });

    {
      let range = null;

      const update = (value) => {
        this.#color.h = value / 127 * 360;
        this.#hue.value = value;
        range.value = value;
        this.#updateColor();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Hue';
        });

        field.addInput('number', (e) => {
          this.#hue = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration)[0]);
    }

    {
      let range = null;

      const update = (value) => {
        this.#color.s = value / 127;
        this.#saturation.value = value;
        range.value = value;
        this.#updateColor();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Saturation';
        });

        field.addInput('number', (e) => {
          this.#saturation = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });

        update(this.getConfiguration(data.configuration)[1]);
      });
    }

    {
      let range = null;

      const update = (value) => {
        this.#color.v = value / 127;
        this.#brightness.value = value;
        range.value = value;
        this.#updateColor();
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Brightness';
        });

        field.addInput('number', (e) => {
          this.#brightness = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.value = this.#brightness.value;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(this.getConfiguration(data.configuration)[2]);
    }

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, [
      this.#hue.value,
      this.#saturation.value,
      this.#brightness.value
    ]);
  }
}

// Single controller configuration.
class V2SettingsController extends V2SettingsModule {
  static type = 'controller';

  #controller = Object.seal({
    element: null,
  });

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    let text = null;
    let range = null;

    const update = (number) => {
      text.textContent = V2MIDI.CC.Name[number] || 'Controller ' + number;
      this.#controller.element.value = number;
      range.value = number;
    }

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = 'CC';
      });

      field.addButton((e) => {
        text = e;
        e.classList.add('width-text-wide');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#controller.element = e;
        e.classList.add('width-number');
        e.min = 0;
        e.max = 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      range = e;
      e.classList.add('range');
      e.type = 'range';
      e.min = 0;
      e.max = 127;
      e.addEventListener('input', () => {
        update(e.value);
      });
    });

    update(this.getConfiguration(data.configuration));
    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#controller.element.value);
  }
}

// Drum pad MIDI settings.
class V2SettingsDrum extends V2SettingsModule {
  static type = 'drum';

  #controller = null;
  #note = null;
  #aftertouch = null;
  #sensitivity = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    const drum = this.getConfiguration(data.configuration);
    if (drum.controller != null) {
      let text = null;
      let range = null;

      const updateController = (number) => {
        if (number > 0)
          text.textContent = V2MIDI.CC.Name[number] || 'CC ' + number;

        else
          text.textContent = 'Disabled';
      };

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Controller';
        });

        field.addButton((e) => {
          text = e;
          e.classList.add('width-text-wide');
          e.classList.add('has-background-light');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#controller = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.value = drum.controller;
          e.addEventListener('input', () => {
            updateController(e.value);
            range.value = e.value;
          });

          updateController(e.value);
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.value = this.#controller.value;
        e.addEventListener('input', () => {
          this.#controller.value = Number(e.value);
          updateController(e.value);
        });
      });
    }

    if (drum.note != null) {
      let note = null;
      let range = null;

      const updateNote = (number) => {
        note.textContent = V2MIDI.Note.name(number) + (V2MIDI.GM.Percussion.Name[number] ? ' – ' + V2MIDI.GM.Percussion.Name[number] : '');
        if (V2MIDI.Note.isBlack(number)) {
          note.classList.add('is-dark');
          note.classList.remove('has-background-light');

        } else {
          note.classList.remove('is-dark');
          note.classList.add('has-background-light');
        }
      }

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Note';
        });

        field.addButton((e) => {
          note = e;
          e.classList.add('width-text-wide');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#note = e;
          e.classList.add('width-number');
          e.min = 0;
          e.max = 127;
          e.value = drum.note;
          e.addEventListener('input', () => {
            updateNote(e.value);
            range.value = e.value;
          });

          updateNote(e.value);
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 0;
        e.max = 127;
        e.value = this.#note.value;
        e.addEventListener('input', () => {
          this.#note.value = Number(e.value);
          updateNote(e.value);
        });
      });
    }

    if (drum.aftertouch != null) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Aftertouch';
          e.tabIndex = -1;
        });

        field.addElement('label', (label) => {
          label.classList.add('switch');

          V2Web.addElement(label, 'input', (e) => {
            this.#aftertouch = e;
            e.type = 'checkbox';
            e.checked = drum.aftertouch;
          });

          V2Web.addElement(label, 'span', (e) => {
            e.classList.add('check');
          });
        });
      });
    }

    if (drum.sensitivity != null) {
      let sensitivity = null;
      let range = null;

      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          sensitivity = e;
          e.classList.add('width-label');
          e.classList.add('inactive');
          e.classList.add('has-background-grey-lighter');
          e.tabIndex = -1;
          e.textContent = 'Sensitivity';
        });

        field.addInput('number', (e) => {
          this.#sensitivity = e;
          e.classList.add('width-label'); // -0.99 does not fit
          e.min = -0.99;
          e.max = 0.99;
          e.step = 0.01;
          e.value = drum.sensitivity;
          e.addEventListener('input', () => {
            range.value = e.value;
          });
        });
      });

      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = -0.99;
        e.max = 0.99;
        e.step = 0.01;
        e.value = this.#sensitivity.value;
        e.addEventListener('input', () => {
          this.#sensitivity.value = Number(e.value);
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    const drum = {};
    if (this.#controller)
      drum.controller = this.#controller.value

    if (this.#note)
      drum.note = this.#note.value

    if (this.#aftertouch)
      drum.aftertouch = this.#aftertouch.checked

    if (this.#sensitivity)
      drum.sensitivity = this.#sensitivity.value

    this.setConfiguration(configuration, drum);
  }
}

// Note selector.
class V2SettingsNote extends V2SettingsModule {
  static type = 'note';

  #note = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    let note = null;
    let range = null;

    const update = (number) => {
      if (number == null || number < 0 || number > 127)
        return;

      note.textContent = V2MIDI.Note.name(number);
      if (V2MIDI.Note.isBlack(number)) {
        note.classList.add('is-dark');
        note.classList.remove('has-background-light');
      } else {
        note.classList.remove('is-dark');
        note.classList.add('has-background-light');
      }

      this.#note.value = Number(number);
      range.value = number;
    }

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.tabIndex = -1;
        e.textContent = setting.label;
      });

      field.addButton((e) => {
        note = e;
        e.classList.add('width-label');
        e.classList.add('inactive');
        e.tabIndex = -1;
      });

      field.addInput('number', (e) => {
        this.#note = e;
        e.classList.add('width-number');
        e.min = (setting.min != null) ? setting.min : 0;
        e.max = (setting.max != null) ? setting.max : 127;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      field.addButton((e) => {
        e.textContent = '-';
        e.style.width = '3rem';
        e.addEventListener('click', () => {
          update(Number(this.#note.value) - 1);
        });
      });

      field.addButton((e) => {
        e.textContent = '+';
        e.style.width = '3rem';
        e.addEventListener('click', () => {
          update(Number(this.#note.value) + 1);
        });
      });
    });

    V2Web.addElement(canvas, 'input', (e) => {
      range = e;
      e.classList.add('range');
      e.type = 'range';
      e.min = this.#note.min;
      e.max = this.#note.max;
      e.addEventListener('input', () => {
        update(e.value);
      });
    });

    update(this.getConfiguration(data.configuration));
    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#note.value);
  }
}

// On/Off switch.
class V2SettingsToggle extends V2SettingsModule {
  static type = 'toggle';

  #toggle = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      field.addButton((e) => {
        e.classList.add('width-text');
        e.classList.add('has-background-light');
        e.classList.add('inactive');
        e.textContent = setting.text;
        e.tabIndex = -1;
      });

      field.addElement('label', (label) => {
        label.classList.add('switch');

        V2Web.addElement(label, 'input', (e) => {
          this.#toggle = e;
          e.type = 'checkbox';
          e.checked = this.getConfiguration(data.configuration);
        });

        V2Web.addElement(label, 'span', (e) => {
          e.classList.add('check');
        });
      });
    });

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#toggle.checked);
  }
}

// Numeric field.
class V2SettingsNumber extends V2SettingsModule {
  static type = 'number';

  #number = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    this.#number = Number(this.getConfiguration(data.configuration));
    let number = null;
    let range = null;
    const min = (setting.min != null) ? setting.min : 0;
    const max = (setting.max != null) ? setting.max : 127;
    const step = (setting.step != null) ? setting.step : 1;
    const select = setting.input == 'select';

    const update = (value) => {
      if (value == null || value < min || value > max)
        return;

      this.#number = Number(value);
      number.value = value;
      range.value = value;
    }

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      if (!select) {
        field.addInput('number', (e) => {
          number = e;
          e.classList.add((step == 1) ? 'width-number' : 'width-number-wide');
          e.min = min
          e.max = max;
          e.step = step;
          e.value = this.#number;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });

        if (step == 1) {
          field.addButton((e) => {
            e.textContent = '-';
            e.style.width = '3rem';
            e.addEventListener('click', () => {
              update(this.#number - 1);
            });
          });

          field.addButton((e) => {
            e.textContent = '+';
            e.style.width = '3rem';
            e.addEventListener('click', () => {
              update(this.#number + 1);
            });
          });
        }

      } else {
        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            for (let i = min; i < max + 1; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = i;
                if (i == this.#number)
                  e.selected = true;
              });
            }

            select.addEventListener('change', () => {
              this.#number = Number(select.value);
            });
          });
        });
      }
    });

    if (!select) {
      V2Web.addElement(canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = number.min;
        e.max = number.max;
        e.step = number.step;
        e.value = number.value;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#number);
  }
}

// Text field.
class V2SettingsText extends V2SettingsModule {
  static type = 'text';

  #text = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    if (setting.title)
      super.addTitle(canvas, setting.title);

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = setting.label;
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#text = e;
        e.classList.add('text-wide');
        e.maxLength = 31;
        e.value = this.getConfiguration(data.configuration);
      });
    });

    return Object.seal(this);
  }

  save(configuration) {
    this.setConfiguration(configuration, this.#text.value);
  }
}

// Title / header.
class V2SettingsTitle extends V2SettingsModule {
  static type = 'title';

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addTitle(canvas, setting.title);
  }
}

// The USB properties. There is no settings entry specified. All devices
// support a custom name, the ports value is optional.
class V2SettingsUSB extends V2SettingsModule {
  static type = 'usb';

  #name = null;
  #vid = null;
  #pid = null;
  #ports = null;

  constructor(device, settings, canvas, setting, data) {
    super(device, settings, setting);
    super.addTitle(canvas, 'USB');

    new V2WebField(canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Name';
        e.tabIndex = -1;
      });

      field.addInput('text', (e) => {
        this.#name = e;
        e.classList.add('text-wide');
        e.maxLength = 31;
        if (data.system.name)
          e.value = data.system.name;
        e.placeholder = data.metadata.product;
      });
    });

    const usbID = (number) => {
      return ('0000' + number.toString(16)).substr(-4)
    };

    if (data.configuration.usb.vid != null) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Vendor ID';
          e.tabIndex = -1;
        });

        field.addInput('text', (e) => {
          this.#vid = e;
          e.classList.add('width-number');
          e.maxLength = 4;
          if (data.configuration.usb.vid > 0)
            e.value = usbID(data.configuration.usb.vid);
          e.placeholder = usbID(data.system.usb.vid);
        });
      });
    }

    if (data.configuration.usb.pid != null) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Product ID';
          e.tabIndex = -1;
        });

        field.addInput('text', (e) => {
          this.#pid = e;
          e.classList.add('width-number');
          e.maxLength = 4;
          if (data.configuration.usb.pid > 0)
            e.value = usbID(data.configuration.usb.pid);
          e.placeholder = usbID(data.system.usb.pid);
        });
      });
    }

    // The number of MIDI ports.
    if (data.system.ports && data.system.ports.announce > 0) {
      new V2WebField(canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.textContent = 'Ports';
          e.tabIndex = -1;
        });

        field.addElement('span', (e) => {
          e.classList.add('select');

          V2Web.addElement(e, 'select', (select) => {
            this.#ports = select;

            for (let i = 1; i < 17; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = i;
                if (i == data.system.ports.configured)
                  e.selected = true;
              });
            }
          });
        });
      });
    }

    return Object.seal(this);
  }

  save(configuration) {
    configuration.usb = {
      'name': this.#name.value
    };

    if (this.#vid)
      configuration.usb.vid = parseInt(this.#vid.value || 0, 16);

    if (this.#pid)
      configuration.usb.pid = parseInt(this.#pid.value || 0, 16);

    if (this.#ports)
      configuration.usb.ports = Number(this.#ports.value);
  }
}
