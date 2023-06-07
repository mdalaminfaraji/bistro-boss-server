const express=require('express');
const app=express();
const cors=require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config() 
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port=process.env.PORT || 5000;

// middleware

app.use(cors());
app.use(express.json());


const verifyJWT=(req, res, next)=>{
  const authorization=req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error:true, message:'unauthorized access'});
  }
  // bearer token
  const token=authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if(err){
        return res.status(401).send({error:true, message:'unauthorized access'});
      }
      req.decoded=decoded;
      next();
    });
}



const uri = `mongodb+srv://${process.env.DB_user}:${process.env.DB_pass}@cluster0.wu2rnap.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const menuCollection = client.db("bistroDb").collection("menu");
    const reviewsCollection = client.db("bistroDb").collection("reviews");
    const cartCollection = client.db("bistroDb").collection("carts"); 
    const userCollection = client.db("bistroDb").collection("users"); 


    app.post('/jwt', (req, res) => {
      const user=req.body;
      const token=jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'1h'});
      res.send({token});
    })

    const verifyAdmin=async (req, res, next) => {
      const email=req.decoded.email;
      const query={email:email};
      const user=await userCollection.findOne(query);
      if(user?.role!=='admin'){
        return res.status(403).send({error:true, message:'forbidden message'}); 
      }
      next();
    }


    /**
     * 0.do not secure links to those who should not see the links
     * 1.use jwt token: verifyJWT
     * 3. use verifyAdmin midddleware
     * 
     */
    // user related apis
    
    app.get("/users",verifyJWT,verifyAdmin,async (req, res) => {
      const result=await userCollection.find().toArray();
      res.send(result); 
    })

    app.post("/users", async (req, res) => {
      const user=req.body;
      console.log(user);
      const query={email:user.email};
      const existingUser=await userCollection.findOne(query);
      console.log("Existing user", existingUser);
      if(existingUser){
        return res.send({message:'user already exists'});
      }
      const result=await userCollection.insertOne(user);
      res.send(result);
    })

    // security layer: verifyJWT
    // email same
    // check admin

    app.get('/users/admin/:email', verifyJWT, async(req, res)=>{
      const email=req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query={email: email};
      const user=await userCollection.findOne(query);
      const result={admin: user?.role==='admin'};
      res.send(result);
    })

    app.patch('/users/admin/:id', async(req, res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const updateDoc={
        $set:{
          role: 'admin',
        }
      }
      const result=await userCollection.updateOne(query,updateDoc);
      res.send(result); 
    })
    
// menu related apis

    app.get('/menu', async(req, res)=>{
        const result=await menuCollection.find().toArray();
        res.send(result);
    })

    app.post('/menu',verifyJWT, verifyAdmin, async(req, res)=>{
      const newItem=req.body;
      const result=await menuCollection.insertOne(newItem);
      res.send(result);
    })

    app.delete('/menu/:id',verifyJWT,verifyAdmin, async(req, res)=>{
      const id=req.params.id;
      const query={$or:[{_id:id},{_id:new ObjectId(id)}]};
      const result=await menuCollection.deleteOne(query);
      res.send(result);
    })
     //review related apis
    app.get('/reviews', async(req, res)=>{
        const result=await reviewsCollection.find().toArray();
        res.send(result);
    })


    //  cart collecton api
    // app.get('/carts', async(req, res)=>{
    //         const result=await cartCollection.find().toArray();
    //         res.send(result);
    //     })
   
        
        //  cart collection api
    app.get('/carts',verifyJWT, async(req, res)=>{
      const email=req.query.email;
      let query={};
      const decodedEmail=req.decoded.email;
      if(email!==decodedEmail){
        return res.status(401).send({error:true,message:'forbidden access'});
      }
      if(email){
        query={email:email};
      }
     
      
      const result=await cartCollection.find(query).toArray();
      res.send(result);
    })
    app.post('/carts',async(req, res)=>{
      const result=await cartCollection.insertOne(req.body);
      res.send(result);
    })

    app.delete('/carts/:id',async(req, res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result=await cartCollection.deleteOne(query);
      res.send(result);

    })

    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('boss is setting');
})

app.listen(port, ()=>{
    console.log(`Bistro boss is sitting on port ${port}`);
})