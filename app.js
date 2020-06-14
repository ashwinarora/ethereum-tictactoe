var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var helmet =  require('helmet')
let PORT

if (process.env.PORT > 0){
    PORT = process.env.PORT
}
else{
    PORT = 5000
}

// const io = require('socket.io')(5000);

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
app.use(helmet());
const server = app.listen(PORT, () => {
    console.log("Listening on PORT: " + PORT);
});
const io = require('socket.io')(server);

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
const privateKey = '89DE4B3D0AFA54F00A08626809CF7B35C421E2ACA1C0FDEEC31FAB901BC7ABDB' // account 4
// const privateKey = '4A82CB9318FC1DE875EA5D6BDC0143A8B8AEECC887BD0ED7C463FD12B524071C' // account 4
const signer = new ethers.Wallet(privateKey, provider);
const contractAddress= '0x395053eC09b1C5597dA10CD26dD55573E3b1A1BA'
const contract = new ethers.Contract(contractAddress, contractData.abi, provider)

// consts based on the enum in the contract
const active = 1
const draw = 2
const player1Wins = 3
const player2Wins = 4
const player1Absconded = 5
const player2Absconded = 6

let game = {
    id: '',
    addressPlayer1: '',
    addressPlayer2: '',
    socketIdPlayer1: '',
    socketIdPlayer2: '',
    escrow: '',
    result: '',
}
let games = []
let gameNumber
const timeout = 60000 // 1 minutes

deployContract()

async function deployContract() {
    // following code depployes the contract and and set values for contract address, contract
    // const factory = new ethers.ContractFactory(contractData.abi, contractData.bytecode, signer)
    // try{
    //     // const overrides = {
    //     //     gasLimit: 496547,
    //     //     gasPrice: ethers.utils.parseUnits('47.0', 'gwei'),
    //     // }
    //     console.log('Deploying Contract')
    //     contract = await factory.deploy()
    //     console.log('Deployed. Waiting for it to be minned')
    //     contractAddress = contract.address
    //     await contract.deployed()
    //     io.emit('contract-deployed-successfully')
    //     console.log(`Contract Deployed Successfully- ${contractAddress}`)
    //     contract = new ethers.Contract(contractAddress, contractData.abi, provider)
        
    //     // console.log('Contract Deployment Code Commented Out')
    // } catch (err) {
    //     console.log(err)
    // }

    //New Approach- have one contract to rule them all
    try{
        gameNumber = parseInt(await contract.getNumberOfGames())
        console.log({gameNumber})
    } catch (err) {
        console.log(err)
    }
}

io.on('connection', function(socket){
    socket.on('request-contract-data', () => {
        // you may want to remore bytecode below as it probably won't be used in index.js.
        // if you decide to remove bytecode from index.js, make sure you remove it from everywhere
        console.log('Incoming Game Request')
        socket.emit('create-new-game', {
            abi: contractData.abi,
            bytecode: contractData.bytecode,
            address: contractAddress
        }) 
    })

    socket.on('new-game-created', (newGameData) => {
        games.push({
            id: newGameData.gameId,
            addressPlayer1: newGameData.addressPlayer1,
            escrow: newGameData.escrow,
            socketIdPlayer1: newGameData.socketIdPlayer1,
            result: 'waiting-for-player2',
            timestamp: Date.now()
        })
        socket.join(`gameId${newGameData.gameId}`)
        console.log('New Game Created')
    })

    socket.on('player2-setup', (joinGameData) => {
        const gameIndex = joinGameData.gameId - gameNumber - 1 // index of the games array
        console.log(`Game Join Request, Index=${gameIndex}`)
        // checking if player2 has already joined
        try {
            // console.log(`addressPlayer2= ${games[gameIndex].addressPlayer2}`)
            // console.log(games[gameIndex])
            // console.log(games)
            if (!games[gameIndex].addressPlayer2) {
                socket.emit('join-game-data', {
                    escrow: games[gameIndex].escrow
                })
            } else {
                console.log('Invalid Game ID')
                socket.emit('invalid-gameId', 'game room is full')
            }
        } catch (err) {
            console.log(err)
            console.log('Invalid Game ID')
            socket.emit('invalid-gameId', 'game room is full')
        }
    })

    socket.on('game-joined', (dataPlayer2) => {
        const gameIndex = dataPlayer2.gameId - gameNumber - 1 // index of the games array
        if (!games[gameIndex].addressPlayer2) {
            console.log(`player2= ${dataPlayer2.addressPlayer2}`)
            games[gameIndex].addressPlayer2 = dataPlayer2.addressPlayer2
            games[gameIndex].socketIdPlayer2 = dataPlayer2.socketIdPlayer2
            games[gameIndex].result = 'active'
            games[gameIndex].timestamp = Date.now()
            console.log(`timestamp= ${games[gameIndex].timestamp}`)
            socket.join(`gameId${games[gameIndex].id}`)
            io.to(`gameId${games[gameIndex].id}`).emit('start-game', {
                addressPlayer1: games[gameIndex].addressPlayer1,
                addressPlayer2: games[gameIndex].addressPlayer2
            })
        } else {
            console.log('Unexpected Error. All is Lost. et tu brutus')
        }
    })

    socket.on('move-made', (move) => {
        const gameIndex = move.gameId - gameNumber - 1
        if (games[gameIndex].result === 'active') {
            io.to(`gameId${games[gameIndex].id}`).emit('opponent-move', move)
        } else {
            console.log('Unexpected Error. Game not Active.')
        }
    })

    socket.on('move-verified', (data) => {
        const gameIndex = data.gameId - gameNumber - 1
        games[gameIndex].timestamp = Date.now()
        console.log(`Old TimeStamp= ${new Date().toTimeString()}`)
    })

    socket.on('singature-invalid', (data) => {
        const gameIndex = data.gameId - gameNumber - 1
        io.to(`gameId${games[gameIndex].id}`).emit('rectify-signature', data)
    })

    socket.on('claim-victory', (move) => {
        const gameIndex = move.gameId - gameNumber - 1
        if (games[gameIndex].result === 'active') {
            io.to(`gameId${games[gameIndex].id}`).emit('verify-victory', move)
        } else {
            console.log('Unexpected Error. Game not Active.')
        }
    })

    socket.on('accept-defeat', async (data) => {
        const gameIndex = data.gameId - gameNumber - 1
        io.to(`gameId${games[gameIndex].id}`).emit('game-over-victory', data)
        const contractWithSigner = contract.connect(signer)
        try {
            if (data.isThisPlayer1) {
                console.log('endGame: player2Wins')
                const tx = await contractWithSigner.endGame(data.gameId, player2Wins)
                await tx.wait()
                console.log(`Transaction Successful, Player 2 Wins: ${tx.hash}`)
                games[gameIndex].timestamp = Date.now()
                games[gameIndex].result = 'player2Wins'
            } else {
                console.log('endGame: player1Wins')
                const tx = await contractWithSigner.endGame(data.gameId, player1Wins)
                await tx.wait()
                console.log(`Transaction Successful, Player 1 Wins: ${tx.hash}`)
                games[gameIndex].timestamp = Date.now()
                games[gameIndex].result = 'player1Wins'
            }
        } catch (err) {
            console.log(err)
        }
    })

    socket.on('declare-draw', async (move) => {
        const gameIndex = move.gameId - gameNumber - 1
        if (games[gameIndex].result === 'active') {
            io.to(`gameId${games[gameIndex].id}`).emit('verify-draw', move)
        } else {
            console.log('Unexpected Error. Game not Active.')
        }
    })

    socket.on('confirm-draw', async (data) => {
        const gameIndex = data.gameId - gameNumber - 1
        try {
            io.to(`gameId${games[gameIndex].id}`).emit('game-over-draw', data)
            const contractWithSigner = contract.connect(signer)
            const tx = await contractWithSigner.endGame(data.gameId, draw)
            await tx.wait()
            console.log(`Transaction Successful, Draw: ${tx.hash}`)
            games[gameIndex].timestamp = Date.now()
            games[gameIndex].result = 'draw'
        } catch (err) {
            console.log(err)
        }
    })

    socket.on('claim-pot', async (data) => {
        const gameIndex = data.gameId - gameNumber - 1
        if (Date.now() - games[gameIndex].timestamp > timeout) {
            console.log('Player Absconded')
            io.to(`gameId${games[gameIndex].id}`).emit('game-over-absconded', data)
            const contractWithSigner = contract.connect(signer)
            try {
                if (data.isThisPlayer1) {
                    const tx = await contractWithSigner.endGame(data.gameId, player1Wins)
                    await tx.wait()
                    console.log(`Transaction Successful, Player 1 Wins: ${tx.hash}`)
                    games[gameIndex].timestamp = Date.now()
                    games[gameIndex].result = 'player1Wins'
                } else {
                    const tx = await contractWithSigner.endGame(data.gameId, player2Wins)
                    await tx.wait()
                    console.log(`Transaction Successful, Player 2 Wins: ${tx.hash}`)
                    games[gameIndex].timestamp = Date.now()
                    games[gameIndex].result = 'player2Wins'
                }
            } catch (err) {
                console.log(err)
            }
        } else {
            console.log('Premature Claimation!')
        }
    })
})

module.exports = app;
