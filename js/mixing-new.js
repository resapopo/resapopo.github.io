// get multiple buffers and mix them
//


// Return decoded audioBuffers as a PromiseOb
function load(playList) {
  try {
    return new Promise ((resolve, reject) => {
      // Fix up prefixing
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      console.log('AudioContext is created');

      // for return
      var bufferList = [];

      for (var i = 0; i < playList.length; i++) {
        // Load buffer asynchronously
        bufferList[i] = fetch(playList[i])
          .then((response) => response.arrayBuffer())
          .then((arrayBuffer) => context.decodeAudioData(arrayBuffer, succeessHandle, errorHandle))
          .catch(function() {
            SendErrorMsg('load', '');
            console.log('error in fetch')
          });
      };

      function succeessHandle(audioBuffer) {
        if (!audioBuffer) {
          alert('error decoding file data: ' + url);
          context.close();
          console.log('AudioContext is closed')
          return;
        };
        //context.close();
        //console.log('AudioContext is closed')
        return audioBuffer;
      };

      function errorHandle(e) {
        SendErrorMsg('load', e);
        console.error(e);
      };

      Promise.all(bufferList)
      .then(bufferList => {console.log(bufferList); resolve(bufferList)})
      .catch(e => {SendErrorMsg('load', e); reject(console.error(e))});
    })
  } catch {
    SendErrorMsg('load', '')
  }  
}


function mixDown(loadedBufferList, givenGains, givenSchedules = []) {
  try {

    let ourNumberOfChannels = 1; // should be automatic!

    // console.log(givenSchedules);
    let scheduledBufferList = schedule(loadedBufferList, ourNumberOfChannels, givenSchedules);

    return _mixDown(scheduledBufferList, ourNumberOfChannels, givenGains);
    //return _mixDown(loadedBufferList, ourNumberOfChannels, givenGains);

    function getSongLength(arrayOfAudioBuffers) {
      try {
        let songLength = 0;

        for(let track of arrayOfAudioBuffers){
          var l = track.length;
          if(l > songLength){
            songLength = l;
          }
        };

        return songLength
      } catch {e => 
        SendErrorMsg('getSongLength', e)
      }
    }

    function schedule(bufferList, numberOfChannels=2, schedules=[]) {
      console.log(schedules);

      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      console.log('AudioContext is created')

      // outputはこれ
      var scheduled = [];

      //first loop for buffer list
      for(let i = 0; i < bufferList.length; i++){

        if (schedules[i]==0) {
          scheduled.push(bufferList[i]);
        } else {

          // 指定された長さの空白audioBufferを生成
          var frameCount = Math.round(context.sampleRate * schedules[i]);
          var _delayBuffer = context.createBuffer(numberOfChannels, frameCount, context.sampleRate);
          
          // ここにdelay処理したbufferをまず格納
          var currentLength = bufferList[i].getChannelData(0).length;
          var newLength = frameCount + currentLength;
          let _scheduled = context.createBuffer(numberOfChannels, newLength, context.sampleRate);

          // second loop for each channel ie. left and right   
          for(let channel = 0; channel < numberOfChannels; channel++){

            // 基音源のbufferをFloat32としてコピー
            var currentBuffer = new Float32Array(currentLength);
            bufferList[i].copyFromChannel(currentBuffer, 0);

            // delayの空白bufferをコピー
            var delayBuffer = new Float32Array(_delayBuffer.length);
            _delayBuffer.copyFromChannel(delayBuffer, 0);

            // 結合
            var newBuffer = new Float32Array(newLength);
            newBuffer.set(delayBuffer);
            newBuffer.set(currentBuffer, frameCount);

            // audioBufferとして格納
            _scheduled.copyToChannel(newBuffer, channel);

          };

          // 出力のため格納し直し
          scheduled.push(_scheduled);
        };
          
          

      };

      //context.close();
      //console.log('AudioContext is closed')
          
      return scheduled
    }

    function _mixDown(bufferList, numberOfChannels = 2, gains){
      try {

        let totalLength = getSongLength(bufferList);

        //create a buffer using the totalLength and sampleRate of the first buffer node
        let finalMix = context.createBuffer(numberOfChannels, totalLength, bufferList[0].sampleRate);

        //first loop for buffer list
        for(let i = 0; i < bufferList.length; i++){

              // second loop for each channel ie. left and right   
              for(let channel = 0; channel < numberOfChannels; channel++){

                //here we get a reference to the final mix buffer data
                let buffer = finalMix.getChannelData(channel);

                    //last is loop for updating/summing the track buffer with the final mix buffer 
                    for(let j = 0; j < bufferList[i].length; j++){
                      //multiple gains
                      var _buffer = bufferList[i].getChannelData(channel)[j]*gains[i];
                      buffer[j] += _buffer;
                    }

              }
        }

        return finalMix;
      } catch {e => 
      SendErrorMsg('_mixDown', e)
      }
    } 
  } catch {e => 
    SendErrorMsg('mixDown', e)
  }
}
// core

/*
*  Acknowledgments

*  Linda Keating
*  https://stackoverflow.com/questions/25040735/phonegap-mixing-audio-files

*  KpTheConstructor
*  https://stackoverflow.com/questions/57155167/web-audio-api-playing-synchronized-sounds

*/