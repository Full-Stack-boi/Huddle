const io = require("socket.io-client");
const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
const document = dom.window.document;

let videoplayer;
let adTimer;
let myid;
let roomid;
let iamhost = false;
let allusersinroom = [];

const port = process.env.PORT || 4000;

/* Server URL */
const socket = io("we-watch-gold.vercel.app");

socket.on("whoami", ({ id }) => {
  // console.log('myid', id);
  myid = id;
});

function checkIsAdPlayng() {
  adTimer = setInterval(() => {
    let isAd = document.querySelector(".ad-cta-wrapper");
    if (isAd === null) {
      getVideoPlayer();
    }
  }, 0.1);
}

function getVideoPlayer() {
  clearInterval(adTimer);

  videoplayer = document.querySelector("video");
  videoplayer.removeAttribute("autoplay");

  //keep listening to the hosts videoplayer events, only host can control the play pause and seek
  if (iamhost) {
    setInterval(function () {
      syncVideoStates();
    }, 0.1);
  }
}

function syncVideoStates() {
  let videoState = {
    hosttime: videoplayer?.currentTime,
    isHostPaused: videoplayer?.paused,
  };
  socket.emit("videoStates", { videoState, roomid });
}

// listen to hosts video player states

socket.on("videoStates", ({ isHostPaused, hosttime }) => {
  // sync video player pause and play of users with the host
  if (!iamhost) {
    if (isHostPaused) {
      videoplayer?.pause();
    } else {
      videoplayer?.play();
    }

    let diffOfSeek = videoplayer?.currentTime - hosttime;

    // sync time if any user is behind by more than 2 s (in case of poor connection)
    // or if any user is forward 2s than everyone
    if (diffOfSeek < -2 || diffOfSeek > 2) {
      videoplayer.currentTime = hosttime;
    }
  }
});

/* HTML OUTPUT ON BROWSER */

/*DIV*/
const hostbutton = document.createElement("div");
const statuss = document.createElement("div");
const main_container = document.createElement("DIV");
const start_container = document.createElement("DIV");
const roomlabel = document.createElement("DIV");
const input = document.createElement("INPUT");
const letspartytitle = document.createElement("DIV");
const nameinput = document.createElement("INPUT");
const joinbutton = document.createElement("DIV");
const closeBtn = document.createElement("div");

/* Implement form CSS */
hostbutton.id = "host-btn";
statuss.id = "status-container";
roomlabel.id = "room-label";
input.id = "room-id-input";
nameinput.id = "name-id";
joinbutton.id = "join-btn";
closeBtn.id = "close-btn";
main_container.classList.add("main-container");
start_container.classList.add("start-container");
letspartytitle.id = "WeWatcheD-title";

/*Text and Placeholder*/
letspartytitle.innerHTML = "Let's Party! 📺 ";
hostbutton.innerHTML = "Start New Room";
nameinput.placeholder = "Enter display name";
input.placeholder = "Enter room Code";
roomlabel.innerHTML = `OR`;
joinbutton.innerHTML = `Join`;
closeBtn.innerHTML = "❌";

/* Main Page */
start_container.appendChild(letspartytitle);
start_container.appendChild(hostbutton);
start_container.appendChild(roomlabel);
start_container.appendChild(input);
start_container.appendChild(joinbutton);
start_container.appendChild(statuss);
start_container.appendChild(nameinput);
main_container.appendChild(start_container);
main_container.appendChild(closeBtn);
document.querySelector("body").appendChild(main_container);

/*Function and Notification */
hostbutton.addEventListener("click", () => {
  if (nameinput.value !== "") {
    localStorage.setItem("lets_party_uname", nameinput.value);
    socket.emit("joinmetothisroom", { roomid: myid, name: nameinput.value });
    roomid = myid;
    iamhost = true;
  } else {
    alert("Enter your display name");
  }
});

joinbutton.addEventListener("click", () => {
  if (input.value !== "" && nameinput.value !== "") {
    localStorage.setItem("lets_party_uname", nameinput.value);
    socket.emit("joinmetothisroom", {
      roomid: input.value,
      name: nameinput.value,
    });
    roomid = input.value;
  } else {
    alert("Enter your Code and Display Name");
  }
});

closeBtn.addEventListener("click", () => {
  main_container.style.right = "-100%";
});

socket.on("joinmetothisroomsuccess", (msg) => {
  let thecode = `<code class="roomcode">${msg}</code>`;

  /* Cut Off the First Main page scene  */
  roomlabel.style.display = "none";
  input.style.display = "none";
  joinbutton.style.display = "none";
  hostbutton.style.display = "none";
  nameinput.style.display = "none";

  /* Second Main page*/
  statuss.innerHTML = `Room Code: <br> ${thecode} <br> Tell everyone to join here! <br> <br> <br>`;

  /* 	setTimeout(() => {
		socket.emit('msg', { data: 'hey', roomid });
	}, 10000); */

  checkIsAdPlayng();
});

socket.on("someonejoined", (name) => {
  if (iamhost) {
    statuss.innerHTML += ` ${name} joined! <br>`;
    allusersinroom.push(name);
    socket.emit("tell_everyone_who_joined", {
      allusers: allusersinroom,
      roomid,
    });
  }
});

socket.on("who_joined", (allusers) => {
  if (!iamhost) {
    allusers?.forEach((user) => {
      statuss.innerHTML += ` ${user} joined! <br>`;
    });
  }
});

socket.on("msg", (msg) => {
  console.log(msg);
});

document.querySelector("body").appendChild(main_container);
