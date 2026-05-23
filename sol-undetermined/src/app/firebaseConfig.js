import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6IxYWc_fDeGpQmX2fqEenUuvCgj8OUHQ",
  authDomain: "sol-undetermined.firebaseapp.com",
  projectId: "sol-undetermined",
  storageBucket: "sol-undetermined.firebasestorage.app",
  messagingSenderId: "687754779669",
  appId: "1:687754779669:web:c74836142f0ec488bf021c",
  measurementId: "G-2DKDQVNHT1"
};

const app = initializeApp(firebaseConfig);

// THIS IS THE EXACT LINE NEXT.JS IS LOOKING FOR:
export const db = getFirestore(app);