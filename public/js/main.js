const chatForm = document.getElementById('chat-form');
const chatMessages=document.querySelector('.chat-messages');
const socket =io();
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');


const {username,room}=Qs.parse(location.search,{
    ignoreQueryPrefix:true
});

socket.emit('joinRoom',{username,room});
socket.on('message',message=>{
    console.log(message);
    outputMessage(message);
    chatMessages.scrollTop=chatMessages.scrollHeight;
});

chatForm.addEventListener('submit',(e)=>{
    e.preventDefault();
    const msg=e.target.elements.msg.value;
    //emit to server
    socket.emit('chatMessage',msg);
    e.target.elements.msg.value="";
    e.target.elements.msg.focus();
});

//Get users and room

socket.on('roomUsers',({room,users})=>{
    outputRoom(room);
    outputUsers(users);
})

function outputRoom(room) {
    roomName.innerText = room;
  }
  
  // Add users to DOM
  function outputUsers(users) {
    userList.innerHTML = `
      ${users.map(user => `<li>${user.username}</li>`).join('')}
    `;
  }
//output to DOM 
function outputMessage(message){
    const div=document.createElement('div');
    div.classList.add('message');
    div.innerHTML=`<p class="meta">${message.username}<span>${message.time}</span></p>
    <p class="text">
        ${message.text}
    </p>`;
    document.querySelector('.chat-messages').appendChild(div);
};