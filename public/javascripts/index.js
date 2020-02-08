const socket = io.connect('http://localhost:5000')
let provider

let contract 
let contractAddress
let abi
let bytecode
let contractWithSigner

let signer
let signerAddress

let gameId
let escrow
let isThisPlayer1

let flatSign
let expSign

connectToMetamask()

function connectToMetamask(){
    if(window.ethereum){
        const metamaskButton = document.getElementById('metamask-button')
        metamaskButton.className = ''
        metamaskButton.addEventListener('click', async () => {
            const accounts = await ethereum.enable()
            metamaskButton.className = 'hidden'
            provider = new ethers.providers.Web3Provider(web3.currentProvider);
            document.getElementById('new-game-button').className = ''
            document.getElementById('join-game-button').className = ''
            setListernes();
        })
    } else {
        document.getElementById('metamask-error').className = ''
    }
}

function setListernes() {
    socket.on('contract-data', (contractData) => {
        abi = contractData.abi
        bytecode = contractData.bytecode
        contractAddress = contractData.address
    })

    socket.on('join-game-data', async (gameData) => {
        escrow = gameData.escrow
        const overrides = {
            value: ethers.utils.parseEther(escrow)
        }
        const tx = await contractWithSigner.joinGame(gameId, overrides)
        const minnedTx = await tx.wait()
        isThisPlayer1 = false
        console.log('Transaction Successful. Game Joined')
        socket.emit('game-joined', {
            gameId: gameId,
            addressPlayer2: signerAddress,
            socketIdPlayer2: socket.Id
        })
    })

    socket.on('start-game', (data) => {
        document.getElementById('game-setup').className = 'hidden'
        document.getElementById('game-play').className = 'main-content'
        //gamePlay()
    })
    gameSetup()
}

function gameSetup(){
    const newGameButton = document.getElementById('new-game-button')
    const joinGameButton = document.getElementById('join-game-button')
    const newGameSetup =  document.getElementById('new-game-setup')
    const joinGameSetup =  document.getElementById('join-game-setup')
    const submitButton = document.getElementById('submit-button')

    newGameButton.addEventListener('click', ()=>{
        if(newGameSetup.className == 'new-game-setup'){
            // Hiding new game setup
            newGameSetup.className = 'hidden new-game-setup'
            joinGameButton.disabled = false
            submitButton.className = 'hidden'
        } else {
            // Showing new game setup
            newGameSetup.className = 'new-game-setup'
            joinGameButton.disabled = true
            submitButton.className = ''
        }
    })

    joinGameButton.addEventListener('click', () => {
        if(joinGameSetup.className == 'join-game-setup'){
            // Hiding join game setup
            joinGameSetup.className = 'hidden join-game-setup'
            newGameButton.disabled = false
            submitButton.className = 'hidden'
        } else {
            // Showing join game setup
            joinGameSetup.className = 'join-game-setup'
            newGameButton.disabled = true
            submitButton.className = ''
        }
    })

    submitButton.addEventListener('click', async () => {
        const inputBet = document.getElementById('input-bet')
        const inputGameId = document.getElementById('input-gameId')
        const gameIdDisplay = document.getElementById('game-id-display')
        const loaderAnimation = document.getElementById('loader-animation')
        loaderAnimation.className = 'loader'
        submitButton.disabled = true

        try{
            socket.emit('request-contract-data')
            signer = await provider.getSigner()
            signerAddress = await signer.getAddress()
            console.log(signerAddress)
            console.log(contractAddress)
            contract = new ethers.Contract(contractAddress, abi, provider)
            contractWithSigner = contract.connect(signer)
            if(!inputBet.value && inputGameId.value){
                gameId = inputGameId.value
                socket.emit('player2-setup', {
                    gameId: gameId,
                    socketIdPlayer2: socket.id
                })
            } else if (inputBet.value && !inputGameId.value) {
                const overrides = {
                    value: ethers.utils.parseEther(inputBet.value)
                }
                const tx = await contractWithSigner.newGame(overrides)
                const minnedTx = await tx.wait()
                gameId = parseInt(ethers.utils.hexlify(minnedTx.events[0].args.gameId))
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
                gameIdDisplay.innerHTML = `Game ID = ${parseInt(ethers.utils.hexlify(minnedTx.events[0].args.gameId))}`
            }
        }catch(err){
            console.log(err)
            submitButton.disabled = false
            loaderAnimation.className = 'loader hidden'
        }
    })
}
