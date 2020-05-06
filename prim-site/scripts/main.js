document.querySelector('ul').onclick = function() {
    alert('便利でしょ');
};

var myImage = document.querySelector('img');

myImage.onclick = function() {
    var mySrc = myImage.getAttribute('src');
    if(mySrc === 'images/radio-cassette.jpg') {
      myImage.setAttribute ('src','images/Tascam-16Track-s.jpg');
    } else {
      myImage.setAttribute ('src','images/radio-cassette.jpg');
    }
}

var myButton = document.querySelector('button');
var myHeading = document.querySelector('h1');

function setUserName() {
  let myName = prompt('あなたの名前を入力してください。');
  if(!myName || myName === null) {
    setUserName();
  } else {
    localStorage.setItem('name', myName);
    myHeading.textContent = 'はじめまして、' + myName;
  }
}

if(!localStorage.getItem('name')) {
  setUserName();
} else {
  var storedName = localStorage.getItem('name');
  myHeading.textContent = 'まいどおおきに、' + storedName;
}

myButton.onclick = function() {
  setUserName();
}