start()
function start(){
    document.getElementById('new-game').addEventListener('click', ()=>{
        const classNewGame =  document.querySelector('.new-game-setup').className

        if(classNewGame == 'new-game-setup'){
            // Hiding new game setup
            document.querySelector('.new-game-setup').className = 'hidden new-game-setup'
            document.getElementById('join-game').className = ''
            document.getElementById('submit-button').className = 'hidden'
        } else {
            // Showing new game setup
            document.querySelector('.new-game-setup').className = 'new-game-setup'
            document.getElementById('join-game').className = 'disabled'
            document.getElementById('submit-button').className = ''
        }
    })

    document.getElementById('join-game').addEventListener('click', () => {
        const classJoinGame =  document.querySelector('.join-game-setup').className

        if(classJoinGame == 'join-game-setup'){
            // Hiding join game setup
            document.querySelector('.new-game-setup').className = 'hidden new-game-setup'
            document.querySelector('.join-game-setup').className = 'hidden join-game-setup'
            document.getElementById('new-game').className = ''
            document.getElementById('submit-button').className = 'hidden'
        } else {
            // Showing join game setup
            document.querySelector('.new-game-setup').className = 'new-game-setup'
            document.querySelector('.join-game-setup').className = 'join-game-setup'
            document.getElementById('new-game').className = 'disabled'
            document.getElementById('submit-button').className = ''
        }
    })
}
