pragma solidity ^0.4.25;

import "./ownable.sol";

contract EthTicTacToe is Ownable{
    
    enum Result {none, active, draw, player1Wins, player2Wins, player1Absconded, player2Absconded}
    
    struct Game{
        address player1;
        address player2;
        uint escrow;
        Result result;
    }
    
    mapping (uint => Game) Games;
    uint numberOfGames;

    uint private earnings;

    event NewGameCreated(uint gameId, address creator);
    event PlayerJoinedGame(uint gameId, address joinee);
    event GameEnded(uint gameId, Result result);

    modifier hasValue() {
        require(msg.value > 0, "Ether required");
        _;
    }
    modifier gameExists(uint _gameId){
        require(_gameId <= numberOfGames, "Invalid Game Id, No such game exists");
        _;
    }
    modifier isGameActive(uint _gameId){
      require(Games[_gameId].result == Result.active, "Game is no longer Active");
      _;
    }
    
    constructor() public {

    }
    /// @notice Allows players to create a new game
    /// @dev new game is generated and values are initialized
    /// @return the ID of the game is returned
    function newGame() payable hasValue external returns(uint){
        ++numberOfGames;
        Game storage game = Games[numberOfGames];
        game.player1 = msg.sender;
        game.escrow = msg.value;
        game.result = Result.active;
        emit NewGameCreated(numberOfGames, msg.sender);
        return numberOfGames;
    }
    
    /// @notice Allows playes to join game already created by someone else
    /// @dev All necessary checks are performed before allowing player to join
    /// @param _gameId ID of the game which is to be joined
    /// @return success True on successful execution. Else the transaction is reverted.
    function joinGame(uint _gameId) payable external hasValue gameExists(_gameId) isGameActive(_gameId) returns(bool success){
        Game storage game = Games[_gameId];
        require(game.player2 == address(0), "Invalid Game Id, Someone has already joined");
        require(msg.value == game.escrow, "Invalid amount of Ether sent");
        require(msg.sender != game.player1, "You cannot play against yourself");
        
        game.player2 = msg.sender;

        emit PlayerJoinedGame(_gameId, msg.sender);
        return true;
    }

    /// @notice we take 10% commission from player's winnings
    function endGame(uint _gameId, Result _result) external onlyOwner returns(bool){
        Game storage game = Games[_gameId];
        uint commission;
        if(_result == Result.player1Wins || _result == Result.player2Absconded){
            commission = game.escrow * 10;
            commission = commission / 100;
            earnings = earnings + commission;
            game.player1.transfer((game.escrow*2) - commission);
            if(_result == Result.player1Wins){
                game.result = Result.player1Wins;
            } else {
                game.result = Result.player2Absconded;
            }
            emit GameEnded(_gameId, game.result);
        } else if(_result == Result.player2Wins || _result == Result.player1Absconded){
            commission = game.escrow * 10;
            commission = commission / 100;
            earnings = earnings + commission;
            game.player2.transfer((game.escrow*2) - commission);
            if(_result == Result.player2Wins){
                game.result = Result.player2Wins;
            } else {
                game.result = Result.player1Absconded;
            }
            emit GameEnded(_gameId, game.result);
        } else if(_result == Result.draw){
            /// no commission charged when it is a draw
            game.player1.transfer(game.escrow);
            game.player2.transfer(game.escrow);
            game.result = Result.draw;
            emit GameEnded(_gameId, game.result);
        } else {
            revert("Unexpected Error");
        }
    }

    function withdrawEarnings() external onlyOwner{
        msg.sender.transfer(earnings);
    }

    function getEarnings() external view onlyOwner returns(uint){
        return earnings;
    }

    /// Returns the address that signed a given string message
    /// copied from https://docs.ethers.io/ethers.js/html/cookbook-signing.html
    function verifyString(string message, uint8 v, bytes32 r, bytes32 s) public pure returns (address signer) {
        // The message header; we will fill in the length next
        string memory header = "\x19Ethereum Signed Message:\n000000";

        uint256 lengthOffset;
        uint256 length;
        assembly {
            // The first word of a string is its length
            length := mload(message)
            // The beginning of the base-10 message length in the prefix
            lengthOffset := add(header, 57)
        }

        // Maximum length we support
        require(length <= 999999);

        // The length of the message's length in base-10
        uint256 lengthLength = 0;

        // The divisor to get the next left-most message length digit
        uint256 divisor = 100000;

        // Move one digit of the message length to the right at a time
        while (divisor != 0) {

            // The place value at the divisor
            uint256 digit = length / divisor;
            if (digit == 0) {
                // Skip leading zeros
                if (lengthLength == 0) {
                    divisor /= 10;
                    continue;
                }
            }

            // Found a non-zero digit or non-leading zero digit
            lengthLength++;

            // Remove this digit from the message length's current value
            length -= digit * divisor;

            // Shift our base-10 divisor over
            divisor /= 10;

            // Convert the digit to its ASCII representation (man ascii)
            digit += 0x30;
            // Move to the next character and write the digit
            lengthOffset++;

            assembly {
                mstore8(lengthOffset, digit)
            }
        }

        // The null string requires exactly 1 zero (unskip 1 leading 0)
        if (lengthLength == 0) {
            lengthLength = 1 + 0x19 + 1;
        } else {
            lengthLength += 1 + 0x19;
        }

        // Truncate the tailing zeros from the header
        assembly {
            mstore(header, lengthLength)
        }

        // Perform the elliptic curve recover operation
        bytes32 check = keccak256(header, message);

        return ecrecover(check, v, r, s);
    }
    
}