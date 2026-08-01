import { initializeApp } from "firebase/app";
import { getDatabase, ref, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDLQKvEA_0as6P9q-pJjRUCDIYzy7zhHkU",
  authDomain: "paytrack-lk.firebaseapp.com",
  databaseURL: "https://paytrack-lk-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "paytrack-lk",
  storageBucket: "paytrack-lk.firebasestorage.app",
  messagingSenderId: "954953990514",
  appId: "1:954953990514:web:19ef0b5bb11d5f45455deb"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

console.log("Attempting to connect and write to Firebase...");

set(ref(database, 'test_connection'), { timestamp: Date.now() })
  .then(() => {
    console.log("SUCCESS: Written to database successfully! Your rules are open.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("FAILED to write to database:", error.message);
    process.exit(1);
  });
