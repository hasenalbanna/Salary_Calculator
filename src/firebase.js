import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDLQKvEA_0as6P9q-pJjRUCDIYzy7zhHkU",
  authDomain: "paytrack-lk.firebaseapp.com",
  databaseURL: "https://paytrack-lk-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "paytrack-lk",
  storageBucket: "paytrack-lk.firebasestorage.app",
  messagingSenderId: "954953990514",
  appId: "1:954953990514:web:19ef0b5bb11d5f45455deb",
  measurementId: "G-XSWDJH1LXH"
};

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
