# [fit] Message in a Browser

^ show of hands: self-desc as dev, web dev, real-time apps, MEAN stack talk

---

# I like books

^ i'm not alone

---

![](http://www.critical-theory.com/wp-content/uploads/2013/06/marx-racist.jpg)
> "Outside of a dog, a book is man's best friend"
-- Monsieur Marx

---

# Let's make a better book

![](http://shortiedesigns.com/wp-content/uploads/2013/04/e-bookfeatured-images-600x340.jpg)

^ you know that thing where

---

# :book: :arrow_right: :book:

# paper is paper 

![](http://markzware.com/wp-content/uploads/2010/08/Marinoni-Rotary-Printing-Press.jpg)

---

# :phone: :arrow_right: :phone:

# phone is phone

![](http://img1.etsystatic.com/il_fullxfull.201162413.jpg)

^ same thing, right? proximity.

---

# :iphone: 
# :phone: :musical_note: :camera: :computer: 

# device is multiplexer

![](http://img1.etsystatic.com/il_fullxfull.201162413.jpg)

---

![](http://www.amt.edu.au/biognoether.jpg)
> "The modality of medium is the circumflex of loci"
-- Adele Dazeem

---

# Once upon a time

## The web was documents

### Internet + hypertext = :heart:

![right, fit](http://www.gbengasesan.com/fyp/60/f1-9.gif)

---

# Then we got forms

## Rise of the first wave web applications

![fit](http://www.techpaparazzi.com/wp-content/uploads/2010/12/netscape-navigator-web_browser.jpg)

---

# JS IS BORN

## DHTML ruins everything

![right, filtered, fit](/Users/dann/Desktop/Screen Shot 2014-04-27 at 12.16.48 AM.png)

---

# JS IS REBORN

## Second wave web apps

### AKA SPAs

![](https://blog.nodejitsu.com/content/images/2014/Feb/SPAs.png)

---

# [fit] THE WEB WAS:

### [fit] hypertext documents
### [fit] & form-driven apps

![](http://i.telegraph.co.uk/multimedia/archive/00682/bernerslee-404_682192c.jpg)

---

# [fit] THE WEB IS:

### [fit] single page applications
### [fit] & desktop applications
### [fit] & interactive games

![](http://i.stack.imgur.com/08xyb.png)

---

# [fit] THE WEB CAN BE:

### [fit] immersive experiences
### [fit] & interactive tools

![](http://legroup.aalto.fi/wp-content/uploads/2012/02/meemoo-ss.jpg)

^ new categories! massive audience -> zero install!

---

# WHY WEB?

## Browser is OS
## Web is app store
## URL is app install

![](https://pbs.twimg.com/profile_images/1557833527/alwaysbetonjs.png)

---

# Interactive Experiences

# inputs -> :bath: -> outputs

![](http://www.traditionalcatholicpriest.com/wp-content/uploads/2013/07/black-box-airplane.jpg)

---

# Inputs

- HTTP (page load and Ajax via XHR)
- WebSockets, SSE, WebRTC, PostMessage
- Geolocation, Orientation
- Mouse, Keyboard, Touch
- Gamepad, MIDI
- Mic, Camera

![](http://inmnp.host22.com/pictures/mandelbrot_2.png)

---

# HTTP

```javascript
var xhr = new XMLHttpRequest()

xhr.onreadystatechange = function() {
  if (xhr.readyState == 4) {
    callback(xhr.responseText) 
  } 
}

xhr.open('GET', target, true)
xhr.send(null)
```

---

# WebSockets (server)

```javascript
var io = require('socket.io').listen(80);

io.sockets.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  
  socket.on('my other event', function (data) {
    console.log(data);
  });
});
```

---

# WebSockets (browser)

```javascript
<script src="/socket.io/socket.io.js"></script>
```

```javascript
<script>
  var socket = io.connect('http://localhost');
      
  socket.on('news', function (data) {
    console.log(data);
    socket.emit('my other event', { my: 'data' });
  });
</script>
```

---

# WebRTC

```javascript
var conn = peer.connect('another-peers-id');
conn.on('open', function(){
  conn.send('hi!');
});

peer.on('connection', function(conn) {
  conn.on('data', function(data){
    console.log(data);
  });
});
```

---

# Location

```javascript
var options = { enableHighAccuracy: true
              , maximumAge: 0
              , timeout: 5000
              }

function success(pos) {
  var crd = pos.coords
  console.log( ' Latitude: '    + crd.latitude
             + ' Longitude: '   + crd.longitude
             + ' More or less ' + crd.accuracy  + ' meters.') }

function error(err) { console.warn('ERROR(' + err.code + '): ' + err.message) }

navigator.geolocation.getCurrentPosition(success, error, options)
```

---

# Orientation

```javascript
screen.addEventListener("orientationchange", handleScreenOrientation)

screen.lockOrientation('landscape')

window.addEventListener("deviceorientation", handleOrientation, true)

window.addEventListener("devicemotion", handleMotion, true)
```


---

# MIDI

```javascript
function onMIDISuccess( midiAccess ) { window.midiAccess = midiAccess }
function onMIDIFailure(msg) { console.log( "Failed to get MIDI access - " + msg ) }
navigator.requestMIDIAccess().then( onMIDISuccess, onMIDIFailure )

function onMIDIMessage( event ) {
  var str = "MIDI message received at timestamp " + event.timestamp 
          + "[" + event.data.length + " bytes]: "
  for (var i=0; i < event.data.length; i++)
    str += "0x" + event.data[i].toString(16) + " "
  console.log( str )
}

function startLoggingMIDIInput( midiAccess, indexOfPort ) {
  midiAccess.inputs.entries[indexOfPort].onmidimessage = onMIDIMessage }
```

---

# Gamepad

```javascript
function runAnimation() {
  window.requestAnimationFrame(runAnimation)

  var gamepads = navigator.getGamepads()

  for (var i = 0; i < gamepads.length; ++i) {
    var pad = gamepads[i]
    console.log(pad.axes, pad.buttons)
  }
}

window.requestAnimationFrame(runAnimation);
```

---

# Microphone

```javascript
var constraints = { audio: true }
var context = new webkitAudioContext()

var gotMic = function(localMediaStream) {
  context.createMediaStreamSource(stream)
         .connect(context.destination)
}

var noMic = function(err) { 
  console.log("Error: " + err) }

navigator.getMedia (constraints, gotMic, noMic)
```


---

# Camera

```javascript
var constraints = { video: true, audio: true }

var gotStream = function(localMediaStream) {
  var video = document.querySelector('video')
  var canvas = document.getElementById('photo')
  video.src = window.URL.createObjectURL(localMediaStream)
  video.onloadedmetadata = function(e) {
     canvas.width = video.videoWidth
     canvas.height = video.videoHeight
  }
}

var noStream = function(err) { console.log("The following error occurred: " + err) }

navigator.getMedia (constraints, gotStream, noStream)
```

---

# [fit] DEMO TIME!

![](http://img638.imageshack.us/img638/6223/joyofcats.jpg)

---

## @dann
## dxnn @ github
## dann @ bentobox . net

![](http://images.nationalgeographic.com/wpf/media-live/photos/000/006/cache/manatee_621_600x450.jpg)

---

ack too far

^ ![](/Users/dann/Downloads/WebRTCpublicdiagramforwebsite \(2\).png)
^ ![](http://i232.photobucket.com/albums/ee227/fantasyofflaws/tumblr_m64aku44wC1rynz9jo1_500.gif)
^ ![](http://icons-ak.wunderground.com/data/wximagenew/c/cameraperson/315.gif)
^ ![](http://infosthetics.com/archives/haskell_universe.jpg)
^ ![](http://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Position_servo_and_signal_flow_graph.png/640px-Position_servo_and_signal_flow_graph.png)
^ ![](http://www.math.ucr.edu/home/baez/YBC7289.jpg)
^ ![](http://www.math.ucr.edu/home/baez/mathematical/projective_plane_of_order_3_rob_harris.png)
^ ![](http://i.imgur.com/xleRH.gif)
^ ![](http://media-cache-ec0.pinimg.com/736x/45/3c/82/453c82e1adca8bc7321d9fc268b52b21.jpg)
