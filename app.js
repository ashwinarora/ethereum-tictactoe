var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

const io = require('socket.io')(5000);

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

const ethers = require('ethers');

const contractData = require('./contractData.js');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

//-----------code after this-------------

const provider = ethers.getDefaultProvider('ropsten');
const privateKey = '4A82CB9318FC1DE875EA5D6BDC0143A8B8AEECC887BD0ED7C463FD12B524071C' // account 4
const signer = new ethers.Wallet(privateKey, provider);
let contract
let contractAddress

let game = {
    Id: '',
    addressPlayer1: '',
    addressPlayer2: '',
    socketIdPlayer1: '',
    socketIdPlayer2: '',
    escrow: '',
    result: ''
}
let games = []
let numberOfGames = 0

deployContract()

async function deployContract() {
    const factory = new ethers.ContractFactory(contractData.abi, contractData.bytecode, signer)
    try{
        console.log('Deploying Contract')
        contract = await factory.deploy()
        console.log('Deployed. Waiting for it to be minned')
        contractAddress = contract.address
        await contract.deployed()
        console.log(`Contract Deployed Successfully- ${contractAddress}`)
        contract = new ethers.Contract(contractAddress, contractData.abi, provider)
    } catch (err) {
        console.log(err)
    }
}

io.on('connection', function(socket){
    socket.on('request-contract-data', () => {
        // you may want to remore bytecode below as it probably won't be used in index.js.
        // if you decide to remove bytecode from index.js, make sure you remove it from everywhere
        console.log('emiting contract data')
        socket.emit('contract-data', {
            abi: contractData.abi,
            bytecode: contractData.bytecode,
            address: contractAddress
        })
    })

    socket.on('new-game-created', (newGameData) => {
        numberOfGames++
        game.id = newGameData.gameId
        game.addressPlayer1 = newGameData.addressPlayer1
        game.escrow = newGameData.escrow
        game.socketIdPlayer1 = newGameData.socketIdPlayer1
        games.push(game)
        socket.join(`gameId${game.id}`)
        console.log('new game created')
    })

    socket.on('player2-setup', (joinGameData) => {
        const gameIndex = joinGameData.gameId - 1; // index of the games array
        console.log(`gameIndex= ${gameIndex}`)
        // checking if player2 has already joined
        if(!games[gameIndex].addressPLayer2){
            socket.emit('join-game-data', {
                escrow: games[gameIndex].escrow
            })
        } else {
            socket.emit('invalid-gameId', 'game room is full')
        }
    })

    socket.on('game-joined', (dataPlayer2) => {
        const gameIndex = dataPlayer2.gameId - 1; // index of the games array
        if(!games[gameIndex].addressPLayer2){
            games[gameIndex].addressPLayer2 = dataPlayer2.addressPLayer2
            games[gameIndex].socketIdPlayer2 = dataPlayer2.socketIdPlayer2
            socket.join(`gameId${games[gameIndex].id}`)
            io.to(`gameId${games[gameIndex].id}`).emit('start-game')
        } else {
            console.log('Unexpected Error. All is Lost. et tu brute')
        }
    })
})

module.exports = app;
