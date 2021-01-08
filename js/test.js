

class MyInputNumber extends HTMLElement {
  constructor() {
    super();

    var shadow = this.attachShadow({mode: 'open'});

    var maxValue = this.getAttribute('max');
    var initValue = this.getAttribute('value');
    var id = this.getAttribute('id');

    const micGain = document.createElement('input');
    micGain.setAttribute('type', 'number');
    micGain.setAttribute('id', id);
    micGain.value = initValue;
    micGain.readOnly = true;

    const gainUpBtn = document.createElement('button');
    gainUpBtn.setAttribute('class', 'spiner');
    gainUpBtn.setAttribute('id', 'upBtn');
    gainUpBtn.innerHTML = '▲';
    gainUpBtn.addEventListener('click', {gain: micGain, max: maxValue, handleEvent: gainUp});
    
    const gainDownBtn = document.createElement('button');
    gainDownBtn.setAttribute('class', 'spiner');
    gainDownBtn.setAttribute('id', 'downBtn');
    gainDownBtn.innerHTML = '▼';
    gainDownBtn.addEventListener('click', {gain: micGain, handleEvent: gainDown});
    
    shadow.appendChild(gainUpBtn);
    shadow.appendChild(micGain);
    shadow.appendChild(gainDownBtn);

    // Apply external styles to the shadow dom
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', 'css/custom_class.css');

    // Attach the created element to the shadow dom
    shadow.appendChild(linkElem);
  }
    
}

customElements.define('my-inputnumber', MyInputNumber);

/*
<div class="customInputNumber">
    <button class="spiner" id="upBtn">△</button>
    <input type="number" id="micGain" value="5" readonly>
    <button class="spiner" id="downBtn">▽</button>
</div>
*/

function gainUp() {
  var oldValue = Number(this.gain.value);
  if (oldValue < this.max) {
    var newValue = oldValue + 1;
    // gain.value = ("0" + newValue).slice(-2);
    this.gain.value = newValue;
  }
}


function gainDown() {
  var oldValue = Number(this.gain.value);
  if (oldValue > 1) {
    var newValue = oldValue - 1;
    // gain.value = ("0" + newValue).slice(-2);
    this.gain.value = newValue;
  }
}


class MyCheckBox extends HTMLElement {
  constructor() {
    super();

    var shadow = this.attachShadow({mode: 'open'});

    var num = this.getAttribute('num');

    const dammyCheckBox = document.createElement('input');
    dammyCheckBox.setAttribute('type', 'checkbox');
    dammyCheckBox.setAttribute('id', `checkbox-${num}`);

    const customCheckBox = document.createElement('label');
    customCheckBox.setAttribute('for', `checkbox-${num}`);

    shadow.appendChild(dammyCheckBox);
    shadow.appendChild(customCheckBox);

    // Apply external styles to the shadow dom
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', 'css/custom_class.css');

    // Attach the created element to the shadow dom
    shadow.appendChild(linkElem);
  }
    
}

customElements.define('my-checkbox', MyCheckBox);

/*
<div id="customInputCheckbox">
      <input type="checkbox" id="check1">
      <label for="check1"></label>
</div>
*/