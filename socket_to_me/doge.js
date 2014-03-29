var app = require('http').createServer(handler)
var fs = require('fs')
var html = fs.readFileSync(__dirname + '/doge.html')
function handler (req, res) { res.writeHead(200); res.end(html) }
app.listen(8001)

var io = require('socket.io').listen(app)
var newrate = 1000, velocity = 0

io.sockets.on('connection', function (socket) {
  socket.on('bought', function (amount) {
    amount = +amount
    if(Math.abs(amount) < 1) return false
    var sign = Math.abs(amount) / amount
    velocity += Math.log(Math.abs(amount)) * sign
    console.log(amount, sign, velocity)
  })
  
  setInterval(function() {
    newrate += velocity + (Math.random() * 10) - 5
    velocity *= 0.85
    io.sockets.emit('newrate', ~~newrate)
  }, 333)
  
})