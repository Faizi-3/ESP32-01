// Firebase Config - REPLACE WITH YOUR ACTUAL CONFIG IF DIFFERENT
const firebaseConfig = {
  apiKey: "AIzaSyDP_sHx9_EyBVHlEhiJcjyzVbJMtfYDT-Q",
  authDomain: "esp32-01-e981e.firebaseapp.com",
  databaseURL:
    "https://esp32-01-e981e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "esp32-01-e981e",
  storageBucket: "esp32-01-e981e.firebasestorage.app",
  messagingSenderId: "1091034304678",
  appId: "1:1091034304678:web:4e392723c2930800a22467",
};
firebase.initializeApp(firebaseConfig);

// --- DOM Elements ---
const loginForm = document.getElementById("loginForm");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const clickSound = document.getElementById("clickSound");
const toggleOnSound = document.getElementById("toggleOnSound");
const soundToggle = document.getElementById("soundToggle");
const animToggle = document.getElementById("animToggle");
const settingsDiv = document.getElementById("settings");
const settingsBtn = document.getElementById("settingsBtn");

// --- Configuration & State Variables ---
const allowedEmail = "abc@gmail.com";
const allowedPassword = "1234567890";
let lastChangedTimes = {};
let timerInterval;
let soundsEnabled = true;
let animEnabled = true;

// --- Utility Functions ---
function updateHUD() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;

  let greeting = "Good Morning";
  if (hours >= 12 && hours < 17) greeting = "Good Afternoon";
  else if (hours >= 17 && hours < 20) greeting = "Good Evening";
  else if (hours >= 20 || hours < 5) greeting = "Good Night";

  document.getElementById("greeting").innerText = greeting;
  document.getElementById("time").innerText = `${hour12}:${minutes} ${ampm}`;
  const dayName = now.toLocaleDateString(undefined, { weekday: "long" });
  const dateStr = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  document.getElementById("dayDate").innerText = `${dayName}, ${dateStr}`;
}

function playClickSound() {
  if (soundsEnabled) {
    clickSound.currentTime = 0;
    clickSound.play();
    setTimeout(() => clickSound.pause(), 500);
  }
}
function playToggleOnSound() {
  if (soundsEnabled) {
    toggleOnSound.currentTime = 0;
    toggleOnSound.play();
    setTimeout(() => toggleOnSound.pause(), 500);
  }
}

// --- Login ---
loginBtn.addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) return alert("Please enter email and password.");
  if (email === allowedEmail && password === allowedPassword) {
    firebase
      .auth()
      .signInWithEmailAndPassword(email, password)
      .then(() => {
        loginForm.style.display = "none";
        dashboard.style.display = "block";
        document.querySelector(".status-dot").style.backgroundColor = "#28a745";
        startRelayControl();
        playToggleOnSound();
      })
      .catch((err) => alert("Firebase login failed: " + err.message));
  } else alert("Invalid email or password.");
});

document.getElementById("logoutBtn").onclick = () => {
  firebase
    .auth()
    .signOut()
    .then(() => {
      dashboard.style.display = "none";
      loginForm.style.display = "block";
      document.querySelector(".status-dot").style.backgroundColor = "#ff3b3b";
      clearInterval(timerInterval);
      lastChangedTimes = {};
      playToggleOnSound();
    })
    .catch((err) => alert("Logout failed: " + err.message));
};

// --- Relay Control ---
function startRelayControl() {
  const db = firebase.database();
  const relays = [
    { id: 1, path: "relay1" },
    { id: 2, path: "relay2" },
    { id: 3, path: "relay3" },
    { id: 4, path: "relay4" },
  ];

  relays.forEach((relay) => {
    const statusText = document.getElementById(`status${relay.id}`);
    const toggleButton = document.getElementById(`btn${relay.id}`);
    const relayRef = db.ref("/" + relay.path);

    relayRef.on("value", (snapshot) => {
      const data = snapshot.val() || {};
      const state = data.state || false;
      const lastChangedTimestamp =
        typeof data.lastChanged === "number" ? data.lastChanged : Date.now();

      // Always set a valid timestamp so timer works (fixes Switch 1 issue)
      lastChangedTimes[relay.id] = lastChangedTimestamp;

      statusText.innerText = state ? "ON" : "OFF";
      toggleButton.classList.toggle("active", state);
      toggleButton.innerText = "";
      statusText.classList.toggle("on", state);
      statusText.classList.toggle("off", !state);

      updateTimeText(relay.id); // Force update immediately
    });

    toggleButton.onclick = () => {
      relayRef.get().then((snap) => {
        const currentState = snap.val()?.state || false;
        playClickSound();
        relayRef.set({ state: !currentState, lastChanged: Date.now() });
      });
    };
  });

  function updateTimeText(relayId) {
    const updatedText = document.getElementById(`updated${relayId}`);
    if (!updatedText) return;

    const now = Date.now();
    const elapsed = Math.floor(
      (now - (lastChangedTimes[relayId] || now)) / 1000
    );

    if (elapsed < 60) {
      updatedText.innerText = `Last changed: ${elapsed} second${
        elapsed !== 1 ? "s" : ""
      } ago`;
    } else if (elapsed < 3600) {
      const minutes = Math.floor(elapsed / 60);
      updatedText.innerText = `Last changed: ${minutes} minute${
        minutes !== 1 ? "s" : ""
      } ago`;
    } else {
      const hours = Math.floor(elapsed / 3600);
      updatedText.innerText = `Last changed: ${hours} hour${
        hours !== 1 ? "s" : ""
      } ago`;
    }
  }

  // Global timer updater
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    relays.forEach((relay) => updateTimeText(relay.id));
  }, 1000);

  // All ON / OFF
  document.getElementById("allOnBtn").onclick = () => {
    const updates = {};
    relays.forEach((r) => {
      updates["/" + r.path] = { state: true, lastChanged: Date.now() };
    });
    db.ref().update(updates).then(playClickSound);
  };
  document.getElementById("allOffBtn").onclick = () => {
    const updates = {};
    relays.forEach((r) => {
      updates["/" + r.path] = { state: false, lastChanged: Date.now() };
    });
    db.ref().update(updates).then(playClickSound);
  };
}

// --- HUD Update ---
setInterval(updateHUD, 1000);
updateHUD();

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    loginForm.style.display = "none";
    dashboard.style.display = "block";
    document.querySelector(".status-dot").style.backgroundColor = "#28a745";
    startRelayControl();
  } else {
    loginForm.style.display = "block";
    dashboard.style.display = "none";
    document.querySelector(".status-dot").style.backgroundColor = "#ff3b3b";
    clearInterval(timerInterval);
    lastChangedTimes = {};
  }
});
