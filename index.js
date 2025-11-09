const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion , ObjectId} = require('mongodb');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 3000;

var admin = require("firebase-admin");

var serviceAccount = require("./firebase-admin-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware 
app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
    console.log('logging information');
    next();
}

const verifyFireBaseToken = async (req, res, next) => {
    if(!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    const token = req.headers.authorization.split(' ')[1];
    if(!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    try {
        const userInfo = await admin.auth().verifyIdToken(token);
        req.token_email = userInfo.email;
        console.log('after token validation', userInfo);
        next();
    }
    catch {
        console.log('invalid token')
        return res.status(401).send({ message: 'unauthorized access' })
    }
}

const verifyJWTToken = (req, res, next) => {

    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        // put it in the right place
        console.log('after decoded', decoded);
        req.token_email = decoded.email;
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@myfirstmongodb.noasusn.mongodb.net/?appName=MyFirstMongoDb`;

app.get('/', (req, res) => {
   res.send('Hello World!')
})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
    try {
        await client.connect();
         const db = client.db('smart_db');
         const productsCollection = db.collection('products');
         const bidsCollection = db.collection('bids');
         const userCollection = db.collection('users');
         app.post('/users' , async(req , res) => {
            const newUser = req.body;
            const email = req.body.email;
            const query = { email: email }
            const existingUser = await userCollection.findOne(query);
            if(existingUser) {
                res.send({message: 'user already exits. do not need to insert again'})
            }
            else {
                const result = await userCollection.insertOne(newUser);
                res.send(result);
            }
        })
        app.get('/latest-products', async (req, res) => {
            const cursor = productsCollection.find().sort({ created_at: -1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.post('/getToken', (req, res) => {
           const loggedUser = req.body;
           const token = jwt.sign(loggedUser, process.env.JWT_SECRET, { expiresIn: '1h' })
            res.send({ token: token })
      })
        app.get('/products' , async(req , res) => {
            console.log(req.query)
            const email = req.query.email;
            const query = {}
            if (email) {
                query.email = email;
            }
            const cursor = productsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/products/:id' , async(req , res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await productsCollection.findOne(query);
            res.send(result);
        })
        app.post('/products' , async(req , res) => {
            console.log("data blw blw blw" , req.headers);
            const newProduct = req.body;
            const result = await productsCollection.insertOne(newProduct);
            res.send(result);
        })
        app.patch('/products/:id', async(req,res)=>{
            const id = req.params.id;
            const updatedProduct = req.body;
            const query = {_id: new ObjectId(id)}
            const update = {
                $set : {
                    name : updatedProduct.name,
                    price: updatedProduct.price
                }
            }
            const result = await productsCollection.updateOne(query,update);
            res.send(result);
        })
        app.delete('/products/:id', async(req,res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await productsCollection.deleteOne(query);
            res.send(result);
        })

        //bids
        app.get('/products/bids/:productId', async (req, res) => {
            const productId = req.params.productId;
            const query = { product: productId }
            const cursor = bidsCollection.find(query).sort({ bid_price: -1 })
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/bids', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            const query = {}
            if (email) {
                query.buyer_email = email
            }
            const cursor = bidsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result);
        })

        app.post('/bids', async (req, res) => {
            const newBid = req.body;
            newBid.product = String(newBid.product);
            const result = await bidsCollection.insertOne(newBid);
            res.send(result);
        });

        app.delete('/bids/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bidsCollection.deleteOne(query);
            res.send(result);
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } 
    finally {
        
    }
}

run().catch(console.dir);

app.listen(port, () => {
   console.log(`Example app listening on port ${port}`)
})