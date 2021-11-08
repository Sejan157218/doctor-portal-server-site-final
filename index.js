const { application, json } = require('express');
const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 8000



app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.57jms.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


// firebase auth service
const serviceAccount = JSON.parse(process.env.FIREBASE_AUTH_ACCOUNT);

console.log(serviceAccount);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// for verify JWT
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}


async function run() {
    try {
        await client.connect();
        const database = client.db("doctor_portal");
        const appoinmentsCollection = database.collection("appointments");
        const usersCollection = database.collection("users");

        // post appointment
        app.post('/appointments', async (req, res) => {
            const body = req.body;
            const result = await appoinmentsCollection.insertOne(body);
            res.json(result)
        })

        // get appointment
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const find = { email: email, date: date }
            const result = await appoinmentsCollection.find(find).toArray();
            res.send(result)
        })

        // post user
        app.post('/users', async (req, res) => {
            const body = req.body;
            const result = await usersCollection.insertOne(body);
            res.json(result)
        })

        // put for google user
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result)
        })
        // put for admin roll
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester })
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result)
                }
            }
            else {
                res.status(403).json({ message: "You don't have access to make admin !" })
            }

        })


        // set admin
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const find = { email: email };
            const user = await usersCollection.findOne(find);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin })
        })


    } finally {
        //   await client.close();  
    }
}
run().catch(console.dir);
app.get('/', (req, res) => {
    res.send('server working!')
})

app.listen(port, () => {
    console.log(`Running doctor server`, port)
})