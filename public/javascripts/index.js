const socket = io.connect('http://localhost:5000');
const provider = new ethers.providers.Web3Provider(web3.currentProvider);

let accounts
let contract 
let contractAddress
let signer
let signerAddress
let flatSign
let expSign
let isThisPlayer1

connectToMetamask()

function connectToMetamask(){
    if(window.ethereum){
        const metamaskButton = document.getElementById('metamask-button')
        metamaskButton.className = ''
        metamaskButton.addEventListener('click', async () => {
            accounts = await ethereum.enable()
            metamaskButton.className = 'hidden'
            document.getElementById('new-game-button').className = ''
            document.getElementById('join-game-button').className = ''
            gameSetup();
        })
    } else {
        document.getElementById('metamask-error').className = ''
    }
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
            newGameSetup.className = 'hidden new-game-setup'
            joinGameSetup.className = 'hidden join-game-setup'
            newGameButton.disabled = false
            submitButton.className = 'hidden'
        } else {
            // Showing join game setup
            newGameSetup.className = 'new-game-setup'
            joinGameSetup.className = 'join-game-setup'
            newGameButton.disabled = true
            submitButton.className = ''
        }
    })

    submitButton.addEventListener('click', async () => {
        const inputBet = document.getElementById('input-bet')
        const inputAddress = document.getElementById('input-address')
        
        if(inputBet.value && inputAddress.value){

        } else if(inputBet.value){
            try{
                signer = await provider.getSigner()
                signerAddress = await signer.getAddress()
                const factory = new ethers.ContractFactory(abi, bytecode, signer)
                contract = await factory.deploy()
                contractAddress = contract.address
                await contract.deployed()
                socket.emit('contract-deployed', {
                    senderAddress: address,
                    socketId: socket.id,
                    addressOfContract: contractAddress,
                    transactionHash: contract.deployTransaction.hash
                })
            }catch(err){
                console.log(err)
            }
            isThisPlayer1 = true
        }
    })
}
