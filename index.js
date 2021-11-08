//to run : node filename.js
const express = require('express')
const app=express();
const cors=require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');
const port=process.env.PORT||5000

// doctors-portal-firebase-adminsdk.json


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) ;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
//middleware
app.use(cors())
app.use(express.json())
//db connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yug9g.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
async function verifyToken(req, res, next) {
  if(req.headers?.authorization?.startsWith('Bearer ')) {
    const token=req.headers.authorization.split(' ')[1];
    console.log(token);
    try {
      const decodedUser=await admin.auth().verifyIdToken(token);
      req.decodedEmail=decodedUser.email;
      console.log(req.decodedEmail);
    }
    catch {

    }
  }
  next();
}
async function run() {
  try {
    await client.connect();
    const database=client.db('doctors_portal');
    const appointmentsCollection=database.collection('appointments');
    const usersCollection=database.collection('users');

    //get methd
    app.get('/appointments',verifyToken, async (req, res) => {
      const email=req.query.email;
      const date=new Date(req.query.date).toLocaleDateString();
      const query  = {email: email, date:date}
      const cursor=appointmentsCollection.find(query);
      const appointments=await cursor.toArray();
      res.json(appointments);
    })
    //post appointment
    app.post('/appointments', async (req, res) => {
      const appointment=req.body;
      const result=await appointmentsCollection.insertOne(appointment);
      res.json(result)
    })
    //find admin
    app.get('/users/:email', async (req, res) => {
      const email=req.params.email;
      const query={email: email};
      const user=await usersCollection.findOne(query);
      let isAdmin=false;
      if(user?.role==='admin') {
        isAdmin=true;
      }
      res.json({admin: isAdmin});
    })
    //regstration user add on db
    app.post('/users', async (req, res) => {
      const user=req.body;
      const result=await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });
    //upserting for google sign in user database
    app.put('/users', async (req, res) => {
      const user=req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
    });
    app.put('/users/admin',verifyToken, async (req, res) => {
      const user=req.body;
      const requester = req.decodedEmail;
      if(requester) {
        const requesterAccount=await usersCollection.findOne({email: requester});
        if(requesterAccount?.role==='admin') {
          const filter={email: user.email};
      const updateDoc={$set: {role: 'admin'}}
          const result=await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }
      else {
        res.status(403).json({message: 'No Access'});
      }



    })

  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => res.send('Hello Doctors!'))

app.listen(port, () => console.log(`Listening at http://localhost:${port}`))
