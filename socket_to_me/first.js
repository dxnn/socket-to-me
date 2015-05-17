var app = require('http').createServer(handler)
var fs = require('fs')
var html = fs.readFileSync(__dirname + '/first.html')
function handler (req, res) { res.writeHead(200); res.end(html) }
app.listen(8000)

var io = require('socket.io').listen(app)

io.sockets.on('connection', function (socket) {
  socket.on('bounce', function (data) {
    io.sockets.emit('bounced', data)
  })
})