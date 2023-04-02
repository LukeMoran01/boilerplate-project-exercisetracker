const express = require('express')
const app = express()
const cors = require('cors')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
require('dotenv').config()

mongoose.connect(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true });

const exerciseSchema = new mongoose.Schema({
  description: {
    type: String
  },
  duration: {
    type: Number
  },
  date: {
    type: String,
    required: false
  }
}, {_id: false})

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  log: {
    type: [exerciseSchema],
    default: []
  }
})

const USER = mongoose.model("user", userSchema)

function createUser(username) {
  const newUser = new USER({
    username: username
  });
  newUser.save()
  return {username: newUser.username, _id: newUser._id};
}

function getUsers() {
  let users = USER.find({}).select('username _id');
  return users;
}

function getUserExercise(id) {
  return USER.findById(id).select('username _id');
}

async function getUserLog(id, filters) {
  let dateFilter = getLogFilter(filters)
  let user = await USER.findById(id).select('-__v');
  let logs = user.log
  
  let filteredLogs = logs.filter(e => {
    let d = new Date(e.date)
    if (dateFilter.from && dateFilter.to) {
      return (d >= dateFilter.from && d <= dateFilter.to)
    } else if (dateFilter.from) {
      return (d >= dateFilter.from)
    } else if (dateFilter.to) {
      return (d <= dateFilter.to)
    } else {
      return true
    }
    
  })
  if (filters.limit) {
    filteredLogs = filteredLogs.slice(0, filters.limit)
  }
  let count = filteredLogs.length
  return {"username": user.username, "_id": user._id, "log": filteredLogs, "count": count}
}

async function addExerciseToUser(id, exercise) {
  let user = await USER.findById(id);
  user.log.push(exercise);
  user.save();
}

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({extended: false}));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/users', (req, res) => {
  let user = createUser(req.body.username);
  return res.json(user);
})

app.get('/api/users', async (req, res) => {
  let users = await getUsers();
  return res.json(users);
})

app.post('/api/users/:_id/exercises', async (req, res) => {
  let date = req.body.date;
  if (!date) date = new Date();
  else date = new Date(date);
  let exercise = {
    "description": req.body.description,
    "duration": +req.body.duration,
    "date": date.toDateString()
  }
  let user = await getUserExercise(req.params._id);
  addExerciseToUser(req.params._id, exercise);
  let userExercise = {...user.toObject(), ...exercise}
  return res.json(userExercise);
})

app.get('/api/users/:_id/logs', async (req, res) => {
  
  let filters = {
    "from": req.query.from,
    "to": req.query.to,
    "limit": req.query.limit
  }
  let user = await getUserLog(req.params._id, filters);

  return res.json(user);
})


// Query for from to and limit -> ? at end of url

function getLogFilter(filterObj) {
  if (filterObj.from && filterObj.to) {
    return {from: new Date(filterObj.from), to: new Date(filterObj.to)}
  } else if (filterObj.from) {
    return {from: new Date(filterObj.from)}
  } else if (filterObj.to) {
    return {to: new Date(filterObj.to)}
  } else return {};
}


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
