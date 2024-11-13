import { ethers, Signature  } from "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.min.js";
const socket = io.connect('https://web-production-fc9f.up.railway.app/');
// const socket = io.connect('http://localhost:5000');
// const socket = io.connect('https://eth-tictactoe.herokuapp.com')
// const socket = io.connect('https://ethereum-tictactoe-diq84fqds-ashwins-projects-bfcbe243.vercel.app/')
// const socket = io.connect('https://ethereum-tictactoe.vercel.app:5000')
// const socket = socketIOClient('eth-tictactoe.herokuapp.com:80') // never worked

let provider
const hiddenClass = 'hidden'

let contract
let contractAddress
let abi
let bytecode
let contractWithSigner

let signer
let signerAddress
let opponentAddress

let gameId
let escrow
let isThisPlayer1

connectToMetamask()

function connectToMetamask() {
    console.log("Hey There, I'm glad to see your interest in my tech. To book a call with me simply write a mail to contact@ashwinarora.com with the subject line-'I opened console of ET3'. Cheers!" )
    if (window.ethereum) {
        const metamaskButton = document.getElementById('metamask-button')
        metamaskButton.classList.remove(hiddenClass)
        metamaskButton.addEventListener('click', async () => {
            const accounts = await ethereum.enable()
            metamaskButton.classList.add(hiddenClass)
            provider = new ethers.BrowserProvider(window.ethereum);
            document.getElementById('game-setup-buttons').classList.remove(hiddenClass)
            setListernes();
        })
    } else {
        document.getElementById('metamask-error').classList.remove(hiddenClass)
    }
}

function setListernes() {
    socket.on('create-new-game', async (contractData) => {
        const submitButton = document.getElementById('submit-button')
        const inputBet = document.getElementById('input-bet')
        const inputGameId = document.getElementById('input-gameId')
        const gameIdDisplay = document.getElementById('game-id-display')
        const invalidGameIdMsg = document.getElementById('invalid-gameId-msg')
        const loaderAnimation = document.getElementById('loader-animation')
        const sameJoinErr = document.getElementById('same-join-err')
        const metamaskRejectionMsg = document.getElementById('metamask-rejection-msg')

        abi = contractData.abi
        bytecode = contractData.bytecode
        contractAddress = contractData.address
        
        signer = await provider.getSigner()
        signerAddress = await signer.getAddress()
        console.log(signerAddress)
        console.log(contractAddress)
        contract = new ethers.Contract(contractAddress, abi, provider)
        contractWithSigner = contract.connect(signer)
        if (!inputBet.value && inputGameId.value) {
            // join game case
            gameId = inputGameId.value
            try{
                socket.emit('player2-setup', {
                    gameId: gameId,
                    socketIdPlayer2: socket.id
                })
            } catch (err){
                console.log(err)
            }
        } else if (inputBet.value && !inputGameId.value) {
            // new game case
            try{
                const overrides = {
                    // gasLimit: 23000,
                    // gasPrice: ethers.parseUnits('70.0', 'gwei'),
                    value: ethers.parseEther(inputBet.value),
                    // chainId: ethers.getNetwork('ropsten').chainId
                }
                const tx = await contractWithSigner.newGame(overrides)
                const minnedTx = await tx.wait()
                console.log(minnedTx)
                gameId = parseInt(minnedTx.logs[0].args.gameId)
                console.log(gameId)
                escrow = inputBet.value
                isThisPlayer1 = true
                console.log(`Transaction Successful, Game ID= ${gameId}`)

                // consider removing socket id incase it does not turn out to be useful
                socket.emit('new-game-created', {
                    gameId: gameId,
                    addressPlayer1: signerAddress,
                    escrow: escrow,
                    socketIdPlayer1: socket.id
                })
                loaderAnimation.classList.add(hiddenClass)
                metamaskRejectionMsg.classList.add(hiddenClass)
                invalidGameIdMsg.classList.add(hiddenClass)
                sameJoinErr.classList.add(hiddenClass)
                gameIdDisplay.classList.remove(hiddenClass)
                document.getElementById('game-id-alert').innerHTML = `<strong>Success!</strong> Game ID= ${gameId}`
            } catch (err) {
                console.log(err)
                loaderAnimation.classList.add(hiddenClass)
                gameIdDisplay.classList.add(hiddenClass)
                invalidGameIdMsg.classList.add(hiddenClass)
                sameJoinErr.classList.add(hiddenClass)
                submitButton.disabled = false
                metamaskRejectionMsg.classList.remove(hiddenClass)
            } 
        }
    })

    socket.on('join-game-data', async (gameData) => {
        const submitButton = document.getElementById('submit-button')
        const gameIdDisplay = document.getElementById('game-id-display')
        const invalidGameIdMsg = document.getElementById('invalid-gameId-msg')
        const loaderAnimation = document.getElementById('loader-animation')
        const sameJoinErr = document.getElementById('same-join-err')
        const metamaskRejectionMsg = document.getElementById('metamask-rejection-msg')

        escrow = gameData.escrow
        const overrides = {
            // gasPrice: ethers.utils.parseUnits('70.0', 'gwei'),
            value: ethers.parseEther(escrow),
            // chainId: ethers.utils.getNetwork('ropsten').chainId
        }
        try {
            console.log('Joining Game')
            const tx = await contractWithSigner.joinGame(gameId, overrides)
            const minnedTx = await tx.wait()
            isThisPlayer1 = false
            console.log('Transaction Successful. Game Joined')
            console.log(`addressPlayer2= ${signerAddress}`)
            // WHY IS ADDRESSPLAYER2 NOT BEING EMITED?
            socket.emit('game-joined', {
                gameId: gameId,
                addressPlayer2: signerAddress,
                socketIdPlayer2: socket.Id
            })
        } catch (err) {
            // error code of when transaction failes because joining account is same as create account
            if( err.code === -32000 || err.code === -32603){
                console.log('same join error')
                loaderAnimation.classList.add(hiddenClass)
                gameIdDisplay.classList.add(hiddenClass)
                invalidGameIdMsg.classList.add(hiddenClass)
                metamaskRejectionMsg.classList.add(hiddenClass)
                submitButton.disabled = false
                sameJoinErr.classList.remove(hiddenClass)
            } else if(err.code === 4001) {
                console.log('user denied transaction')
                loaderAnimation.classList.add(hiddenClass)
                gameIdDisplay.classList.add(hiddenClass)
                invalidGameIdMsg.classList.add(hiddenClass)
                sameJoinErr.classList.add(hiddenClass)
                submitButton.disabled = false
                metamaskRejectionMsg.classList.remove(hiddenClass)
            } else {
                console.log(err)
                loaderAnimation.classList.add(hiddenClass)
                gameIdDisplay.classList.add(hiddenClass)
                invalidGameIdMsg.classList.add(hiddenClass)
                sameJoinErr.classList.add(hiddenClass)
                submitButton.disabled = false
                metamaskRejectionMsg.classList.remove(hiddenClass)
            }
        }

    })

    socket.on('invalid-gameId', (msg) => {
        console.log(msg)
        document.getElementById('submit-button').disabled = false
        document.getElementById('loader-animation').classList.add(hiddenClass)
        document.getElementById('invalid-gameId-msg').classList.remove(hiddenClass)
    })

    socket.on('start-game', (data) => {
        console.log('entering game play')
        if (isThisPlayer1) {
            opponentAddress = data.addressPlayer2
            console.log(`Opponent= ${opponentAddress}`)
        } else {
            opponentAddress = data.addressPlayer1
            console.log(`Opponent= ${opponentAddress}`)
        }
        document.getElementById('game-setup').classList.add(hiddenClass)
        document.getElementById('game-play').classList.remove(hiddenClass)
        setGamePlayListerners()
    })
    gameSetup()
}

function gameSetup() {
    const gameSetup = document.getElementById('game-setup')
    const newGameButton = document.getElementById('new-game-button')
    const joinGameButton = document.getElementById('join-game-button')
    const newGameSetup = document.getElementById('new-game-setup')
    const joinGameSetup = document.getElementById('join-game-setup')
    const submitButton = document.getElementById('submit-button')
    const inputBet = document.getElementById('input-bet')
    const inputGameId = document.getElementById('input-gameId')
    const gameIdDisplay = document.getElementById('game-id-display')
    const invalidGameIdMsg = document.getElementById('invalid-gameId-msg')
    const loaderAnimation = document.getElementById('loader-animation')
    const metamaskRejectionMsg = document.getElementById('metamask-rejection-msg')
    const sameJoinErr = document.getElementById('same-join-err')

    newGameButton.addEventListener('click', () => {
        if (newGameSetup.className == 'new-game-setup') {
            // Hiding new game setup
            newGameSetup.className = 'hidden new-game-setup'
            inputBet.value = null
            joinGameButton.disabled = false
            submitButton.classList.add(hiddenClass)
            invalidGameIdMsg.classList.add(hiddenClass)
            loaderAnimation.classList.add(hiddenClass)
            metamaskRejectionMsg.classList.add(hiddenClass)
            sameJoinErr.classList.add(hiddenClass)
        } else {
            // Showing new game setup
            newGameSetup.className = 'new-game-setup'
            joinGameButton.disabled = true
            submitButton.classList.remove(hiddenClass)
        }
    })

    joinGameButton.addEventListener('click', () => {
        if (joinGameSetup.className == 'join-game-setup') {
            // Hiding join game setup
            inputGameId.value = null
            joinGameSetup.className = 'hidden join-game-setup'
            newGameButton.disabled = false
            submitButton.classList.add(hiddenClass)
            invalidGameIdMsg.classList.add(hiddenClass)
            loaderAnimation.classList.add(hiddenClass)
            metamaskRejectionMsg.classList.add(hiddenClass)
            sameJoinErr.classList.add(hiddenClass)
        } else {
            // Showing join game setup
            joinGameSetup.className = 'join-game-setup'
            newGameButton.disabled = true
            submitButton.classList.remove(hiddenClass)
        }
    })

    submitButton.addEventListener('click', async () => {
        invalidGameIdMsg.classList.add(hiddenClass)
        metamaskRejectionMsg.classList.add(hiddenClass)
        sameJoinErr.classList.add(hiddenClass)
        gameIdDisplay.classList.add(hiddenClass)
        loaderAnimation.classList.remove(hiddenClass)
        newGameButton.disabled = true
        joinGameButton.disabled = true
        submitButton.disabled = true
        
        try {
            socket.emit('request-contract-data')
        } catch (err) {
            console.log(err)
            submitButton.disabled = false
            newGameButton.disabled = false
            joinGameButton.disabled = false
            loaderAnimation.className = 'loader hidden'
        }
    })
}


// --------------GamePlay Code Below-------------

const xClass = 'x'
const circleClass = 'circle'
const waitingClass = 'waiting'
const moveMsg = document.getElementById('make-move-msg')
const waitMsg = document.getElementById('wait-msg')
const invalidSignMsg = document.getElementById('invalid-sign-msg')
const countDownTime = document.getElementById('countdown-timer')
const claimPotButton = document.getElementById('claim-pot-button')
let myTurn
let timer
const timeout = 60000 // 60 seconds
const WINNING_COMBINATIONS = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
]

const cellElements = document.querySelectorAll('[data-cell]')
const board = document.getElementById('board')
let circleTurn

let myClass
let opponentClass

function setGamePlayListerners() {
    console.log(cellElements)
    myClass = isThisPlayer1 ? xClass : circleClass
    opponentClass = isThisPlayer1 ? circleClass : xClass

    // if condition to set waiting class in the very begining of game play
    if (isThisPlayer1) {
        removeWaitClass()
        myTurn = true
        board.classList.add(xClass)
        showMoveMsg()
    } else {
        addWaitClass()
        myTurn = false
        board.classList.add(circleClass)
        showWaitMsg()
    }

    cellElements.forEach(cell => {
        cell.addEventListener('click', handleClick, { once: true })
    })

    resetTimer()

    socket.on('opponent-move', async (move) => {
        if (isThisPlayer1 !== move.isThisPlayer1) {
            const signAddress = await contract.verifyString(move.cellId, move.signature.v, move.signature.r, move.signature.s)
            if (signAddress === opponentAddress) {
                const cell = document.getElementById(move.cellId)
                cell.classList.add(opponentClass)
                myTurn = true
                socket.emit('move-verified', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1
                })
                removeWaitClass()
                resetTimer()
                showMoveMsg()
            } else {
                console.log('Signature Invalid')
                socket.emit('signature-invalid', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1,
                    cellId: move.cellId
                })
            }
        }
    })

    socket.on('rectify-signature', (data) => {
        if (isThisPlayer1 !== data.isThisPlayer1) {
            const cell = document.getElementById(data.cellId)
            cell.classList.remove(myClass)
            removeAndAddClickListener(cell)
            endCountDown()
            removeWaitClass()
            showInvalidSignMsg()
        }
    })

    socket.on('verify-victory', async (move) => {
        if (isThisPlayer1 !== move.isThisPlayer1) {
            const signAddress = await contract.verifyString(move.cellId, move.signature.v, move.signature.r, move.signature.s)
            if (signAddress === opponentAddress) {
                const cell = document.getElementById(move.cellId)
                cell.classList.add(opponentClass)
                if (checkWin(opponentClass)) {
                    socket.emit('accept-defeat', {
                        gameId: gameId,
                        isThisPlayer1: isThisPlayer1,
                        address: signerAddress
                    })
                } else if (isDraw()) {
                    console.log('Draw')
                } else {
                    console.log('Continue Game')
                }
            } else {
                console.log('Signature Invalid')
                socket.emit('signature-invalid', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1,
                    cellId: move.cellId
                })
            }
        }
    })

    socket.on('game-over-victory', (data) => {
        if (isThisPlayer1 !== data.isThisPlayer1) {
            document.getElementById('game-play').classList.add(hiddenClass)
            document.getElementById('game-over').classList.remove(hiddenClass)
            document.getElementById('victory-msg').classList.remove(hiddenClass)
        } else {
            document.getElementById('game-play').classList.add(hiddenClass)
            document.getElementById('game-over').classList.remove(hiddenClass)
            document.getElementById('defeat-msg').classList.remove(hiddenClass)
        }
    })

    socket.on('verify-draw', async (move) => {
        if (isThisPlayer1 !== move.isThisPlayer1) {
            const signAddress = await contract.verifyString(move.cellId, move.signature.v, move.signature.r, move.signature.s)
            if (signAddress === opponentAddress) {
                const cell = document.getElementById(move.cellId)
                cell.classList.add(opponentClass)
                if (isDraw()) {
                    socket.emit('confirm-draw', {
                        gameId: gameId,
                        isThisPlayer1: isThisPlayer1,
                    })
                } else {
                    console.log('not a draw')
                }
            } else {
                console.log('Signature Invalid')
                socket.emit('signature-invalid', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1,
                    cellId: move.cellId
                })
            }
        }
    })

    socket.on('game-over-draw', (data) => {
        document.getElementById('game-play').classList.add(hiddenClass)
        document.getElementById('game-over').classList.remove(hiddenClass)
        document.getElementById('draw-msg').classList.remove(hiddenClass)
    })

    claimPotButton.addEventListener('click', () => {
        socket.emit('claim-pot', {
            gameId: gameId,
            isThisPlayer1: isThisPlayer1
        })
    })

    socket.on('game-over-absconded', (data) => {
        if (isThisPlayer1 !== data.isThisPlayer1) {
            document.getElementById('game-play').classList.add(hiddenClass)
            document.getElementById('game-over').classList.remove(hiddenClass)
            document.getElementById('defeat-msg-abscond').classList.remove(hiddenClass)
        } else {
            document.getElementById('game-play').classList.add(hiddenClass)
            document.getElementById('game-over').classList.remove(hiddenClass)
            document.getElementById('victory-msg-abscond').classList.remove(hiddenClass)
        }
    })
}

async function handleClick(event) {
    const cell = event.target
    if (myTurn) {
        console.log(`clicked ${cell.id}`)
        cell.classList.add(myClass)
        addWaitClass()
        if (checkWin(myClass)) {
            console.log('WINNER')
            try {
                const flatSign = await signer.signMessage(cell.id)
                const expSign = Signature.from(flatSign)
                socket.emit('claim-victory', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1,
                    cellId: cell.id,
                    signature: expSign
                })
                myTurn = false
                showWaitMsg()
            } catch (err) {
                console.log(err)
                cell.classList.remove(myClass)
                removeAndAddClickListener(cell)
                removeWaitClass()
                showInvalidSignMsg()
            }
        } else if (isDraw()) {
            console.log('DRAW')
            try {
                const flatSign = await signer.signMessage(cell.id)
                const expSign = Signature.from(flatSign)
                socket.emit('declare-draw', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1,
                    cellId: cell.id,
                    signature: expSign
                })
                myTurn = false
                showWaitMsg()
            } catch (err) {
                console.log(err)
                cell.classList.remove(myClass)
                removeAndAddClickListener(cell)
                removeWaitClass()
                showInvalidSignMsg()
            }
        } else {
            console.log('Game Continue')
            try {
                // signer = await provider.getSigner()
                const flatSign = await signer.signMessage(cell.id)
                const expSign = Signature.from(flatSign)
                socket.emit('move-made', {
                    gameId: gameId,
                    isThisPlayer1: isThisPlayer1,
                    cellId: cell.id,
                    signature: expSign
                })
                myTurn = false
                resetTimer()
                showWaitMsg()
            } catch (err) {
                console.log(err)
                cell.classList.remove(myClass)
                removeAndAddClickListener(cell)
                removeWaitClass()
                showInvalidSignMsg()
            }
        }
    } else {
        removeAndAddClickListener(cell)
    }
}

function checkWin(checkClass) {
    return WINNING_COMBINATIONS.some(combination => {
        return combination.every(index => {
            return cellElements[index].classList.contains(checkClass)
        })
    })
}

function isDraw() {
    return [...cellElements].every(cell => {
        return cell.classList.contains(xClass) || cell.classList.contains(circleClass)
    })
}

// helper functions below
function addWaitClass() {
    cellElements.forEach(ce => {
        ce.classList.add(waitingClass)
    })
}

function removeWaitClass() {
    cellElements.forEach(ce => {
        ce.classList.remove(waitingClass)
    })
}

function removeAndAddClickListener(cell) {
    cell.removeEventListener('click', handleClick)
    cell.addEventListener('click', handleClick, { once: true })
}

function showMoveMsg() {
    waitMsg.classList.add(hiddenClass)
    invalidSignMsg.classList.add(hiddenClass)
    //claimPotButton.classList.add(hiddenClass)
    moveMsg.classList.remove(hiddenClass)
}

function showWaitMsg() {
    moveMsg.classList.add(hiddenClass)
    invalidSignMsg.classList.add(hiddenClass)
    //claimPotButton.classList.remove(hiddenClass)
    waitMsg.classList.remove(hiddenClass)
}

function showInvalidSignMsg() {
    waitMsg.classList.add(hiddenClass)
    moveMsg.classList.add(hiddenClass)
    invalidSignMsg.classList.remove(hiddenClass)
}

function startCountDown() {
    countDownTime.classList.remove(hiddenClass)
    claimPotButton.classList.add(hiddenClass)
    timer = returnTimer()
}

function endCountDown(){
    countDownTime.classList.add(hiddenClass)
    claimPotButton.classList.add(hiddenClass)
    clearInterval(timer)
}

function resetTimer(){
    endCountDown()
    startCountDown()
}

function returnTimer(){
    const countDown = Date.now() + timeout;
    return setInterval(function () {
        // Find the distance between now and the count down date
        let distance = countDown - Date.now();

        // Time calculations for days, hours, minutes and seconds
        let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((distance % (1000 * 60)) / 1000);

        // Output the result in an element with id="demo"
        countDownTime.innerHTML = minutes + "m " + seconds + "s";

        // If the count down is over, write some text 
        if (distance < 0) {
            clearInterval(timer);
            if(!myTurn){
                countDownTime.classList.add(hiddenClass)
                claimPotButton.classList.remove(hiddenClass)
            } else{
                countDownTime.innerHTML = "Time Up!";
            }
        }
    }, 1000);
}