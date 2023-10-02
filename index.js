const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require('mongoose');
const User = require("./models/Users");
const Post = require('./models/Post');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

require('dotenv').config();
const allowedOrigins = [
    "https://playful-licorice-77db4d.netlify.app"
];


app.use(cors({
    origin: function (origin, callback) {
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'))

const db_connection = process.env.MONGO_STRING;
const secret = process.env.SECRET

mongoose.connect(process.env.MONGO_STRING)
// CORS or Cross-Origin Resource Sharing in Node.js is a mechanism by which a front-end client can make requests for resources to an external back-end server. The single-origin policy does not allow cross-origin requests and CORS headers are required to bypass this feature.
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    bcrypt.hash(password, saltRounds).then(async function (hash) {
        try {
            const userDoc = await User.create({
                username,
                password: hash
            });
            res.json(userDoc);
        }
        catch (error) {
            res.status(400).json(error);
        }
    }).catch(error => {
        console.log(error);
    })

})

app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    console.log("AYYA");
    const userDoc = await User.findOne({ username });
    if (userDoc === null) {
        console.log("AYYA");
        res.status(400).json('Wrong Credentials');
    }
    else {
        bcrypt.compare(password, userDoc.password).then(function (result) {
            if (result) {
                jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
                    if (err) throw err;
                    res.cookie('token', token, { httpOnly: true }).json({
                        id: userDoc._id,
                        username
                    });
                })
            }
            else {
                res.status(400).json('Wrong Credentials');
            }
        });
    }
})

app.get("/profile", (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, secret, {}, (err, info) => {
            if (err) throw err;
            res.json(info);
        })
    }
})
app.post("/logout", (req, res) => {
    res.cookie('token', '').json('ok');
})

app.post("/createNewPost", upload.single('file'), async (req, res) => {
    let newPath = null;
    const { token } = req.cookies;
    if (req.file) {
        const { originalname, path } = req.file;
        const fileParts = originalname.split('.');
        const ext = fileParts[fileParts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }
    if (token) {
        jwt.verify(token, secret, {}, async (err, info) => {
            if (err) throw err;
            res.json("FIR AYYA");
            const { title, content, summary } = req.body;
            const postDoc = await Post.create({
                title,
                content,
                summary,
                file: newPath,
                author: info.id
            });
            res.json(postDoc);
        }).catch(err => {
            res.json(`Error is ${err}`);
        })
    }
    else {
        res.json("Token Not Found");
    }
});

app.get('/post', async (req, res) => {
    const posts = await Post.find().
        populate('author', ['username']).
        sort({ createdAt: -1 }).
        limit(20);
    res.json(posts);
})

app.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    const post = await Post.findById(id).populate('author', ['username']);
    res.json(post);
});

app.put("/post", upload.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const fileParts = originalname.split('.');
        const ext = fileParts[fileParts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { title, content, summary, id } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(info.id) === JSON.stringify(postDoc.author);
        if (!isAuthor) {
            return res.status(400).json("You Are Not The Author .");
        }
        const response = await Post.findOneAndUpdate({ _id: id }, {
            title,
            content,
            summary,
            file: newPath ? newPath : postDoc.file,
        })
        res.json(response);
    });
});


app.listen(4000, () => {
    console.log("Listening on  Port 4000");
})



