// Firebase Config
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

const allowedEmail = "abc@gmail.com";
const allowedPassword = "1234567890";
const loginForm = document.getElementById("loginForm");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("loginBtn");
const clickSound = document.getElementById("clickSound");
const toggleOnSound = document.getElementById("toggleOnSound");

let lastChangedTimes = {};
let timerInterval;

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
setInterval(updateHUD, 1000);
updateHUD();

loginBtn.addEventListener("click", () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password");

  if (!email || !password.value)
    return alert("Please enter email and password.");
  if (email === allowedEmail && password.value === allowedPassword) {
    firebase
      .auth()
      .signInWithEmailAndPassword(email, password.value) // Use .value here
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
      const data = snapshot.val();
      const state = data ? data.state : false;
      const lastChangedTimestamp = data ? data.lastChanged : null;

      statusText.innerText = state ? "ON" : "OFF";
      toggleButton.classList.toggle("active", state);
      toggleButton.innerText = "";

      statusText.classList.toggle("on", state);
      statusText.classList.toggle("off", !state);

      lastChangedTimes[relay.id] = lastChangedTimestamp || Date.now();
      updateTimeText(relay.id);
    }); // Individual toggle button logic (reverted to original, but with robust timer update)

    toggleButton.onclick = () => {
      relayRef
        .get()
        .then((snap) => {
          const data = snap.val();
          const currentState = data ? data.state : false; // Get current state from Firebase

          const desiredState = !currentState; // Standard toggle: flip the state // Only update Firebase if the desired state is truly different from the current state in Firebase

          if (desiredState !== currentState) {
            playClickSound(); // Play sound as state is changing
            relayRef.set({ state: desiredState, lastChanged: Date.now() });
          } else {
            // This block handles cases where the current Firebase state is somehow already
            // the same as the desiredState (e.g., due to rapid clicks, or sync issues).
            // In this case, no actual state change occurs, so the timer is NOT reset.
            playClickSound(); // Optional: Play a sound even if no state change occurred in Firebase
            console.log(
              `Switch ${relay.id} already in desired state (${desiredState}). Timer not reset.`
            );
          }
        })
        .catch((error) => {
          console.error("Error getting relay state:", error);
        });
    };
  });

  function updateTimeText(relayId) {
    const updatedText = document.getElementById(`updated${relayId}`);
    if (!updatedText || !lastChangedTimes[relayId]) return;

    const now = Date.now();
    const elapsed = Math.floor((now - lastChangedTimes[relayId]) / 1000);

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

  timerInterval = setInterval(() => {
    relays.forEach((relay) => {
      if (lastChangedTimes[relay.id]) {
        updateTimeText(relay.id);
      }
    });
  }, 1000); // MODIFIED "All ON" Button Logic

  document.getElementById("allOnBtn").onclick = () => {
    const db = firebase.database();
    const rootRef = db.ref("/"); // Get a reference to the root of your database

    rootRef
      .once("value")
      .then((snapshot) => {
        // Fetch all current states
        const currentData = snapshot.val();
        const updates = {};
        let anyChangeDetected = false;

        relays.forEach((relay) => {
          // Safely get current state; default to false if path/data doesn't exist
          const currentRelayState =
            currentData && currentData[relay.path]
              ? currentData[relay.path].state
              : false;
          const intendedState = true; // For "All ON"

          if (currentRelayState !== intendedState) {
            // Only include in updates if the state is actually changing
            updates["/" + relay.path] = {
              state: intendedState,
              lastChanged: Date.now(),
            };
            anyChangeDetected = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          // Only update if there are actual changes
          db.ref()
            .update(updates)
            .then(() => {
              playClickSound(); // Play sound only if something changed in DB
              console.log("All ON: Updated relays where state changed.");
            })
            .catch((error) => {
              console.error("Error updating relays for All ON:", error);
            });
        } else {
          playClickSound(); // Play sound even if no state change, for user feedback
          console.log(
            "All ON: All relays were already ON. No updates performed."
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching all relay states for All ON:", error);
      });
  }; // MODIFIED "All OFF" Button Logic

  document.getElementById("allOffBtn").onclick = () => {
    const db = firebase.database();
    const rootRef = db.ref("/");

    rootRef
      .once("value")
      .then((snapshot) => {
        const currentData = snapshot.val();
        const updates = {};
        let anyChangeDetected = false;

        relays.forEach((relay) => {
          const currentRelayState =
            currentData && currentData[relay.path]
              ? currentData[relay.path].state
              : false;
          const intendedState = false; // For "All OFF"

          if (currentRelayState !== intendedState) {
            updates["/" + relay.path] = {
              state: intendedState,
              lastChanged: Date.now(),
            };
            anyChangeDetected = true;
          }
        });

        if (Object.keys(updates).length > 0) {
          db.ref()
            .update(updates)
            .then(() => {
              playClickSound();
              console.log("All OFF: Updated relays where state changed.");
            })
            .catch((error) => {
              console.error("Error updating relays for All OFF:", error);
            });
        } else {
          playClickSound();
          console.log(
            "All OFF: All relays were already OFF. No updates performed."
          );
        }
      })
      .catch((error) => {
        console.error("Error fetching all relay states for All OFF:", error);
      });
  };
}

// Logout
document.getElementById("logoutBtn").onclick = () => {
  firebase
    .auth()
    .signOut()
    .then(() => {
      dashboard.style.display = "none";
      loginForm.style.display = "block";
      document.querySelector(".status-dot").style.backgroundColor = "#ff3b3b";
      clearInterval(timerInterval);
      playToggleOnSound(); // Sound on logout
    })
    .catch((err) => alert("Logout failed: " + err.message));
};

// Settings Dropdown + Toggles
const settingsDiv = document.getElementById("settings");
const settingsBtn = document.getElementById("settingsBtn");
const soundToggle = document.getElementById("soundToggle");
const animToggle = document.getElementById("animToggle");

let soundsEnabled = true;
let animEnabled = true;

settingsBtn.onclick = (e) => {
  e.stopPropagation();
  settingsDiv.classList.toggle("open");
};

document.addEventListener("click", (e) => {
  if (!settingsDiv.contains(e.target)) {
    settingsDiv.classList.remove("open");
  }
});

soundToggle.onclick = (e) => {
  e.stopPropagation();
  soundsEnabled = !soundsEnabled;
  soundToggle.classList.toggle("active", soundsEnabled);
};

animToggle.onclick = (e) => {
  e.stopPropagation();
  animEnabled = !animEnabled;
  animToggle.classList.toggle("active", animEnabled);
  document.body.style.animationPlayState = animEnabled ? "running" : "paused";
};

// Sound Hook Functions with 0.5-second duration
function playClickSound() {
  if (soundsEnabled) {
    clickSound.currentTime = 0;
    clickSound.play();
    setTimeout(() => {
      clickSound.pause();
    }, 500);
  }
}
function playToggleOnSound() {
  if (soundsEnabled) {
    toggleOnSound.currentTime = 0;
    toggleOnSound.play();
    setTimeout(() => {
      toggleOnSound.pause();
    }, 500);
  }
}
