// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC-E8fOAkesIxrlzrf0YngkASsy0xSFWuU",
  authDomain: "ict-vr.firebaseapp.com",
  projectId: "ict-vr",
  storageBucket: "ict-vr.firebasestorage.app",
  messagingSenderId: "19432851952",
  appId: "1:19432851952:web:d45ed9796d5aa66f673535",
  measurementId: "G-BKWTXXTQ08"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);