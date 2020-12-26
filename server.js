const express = require('express');
const app = express();
const session = require('cookie-session');
const bodyParser = require('body-parser');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const fs = require('fs');
const formidable = require('express-formidable');

app.use(formidable());
app.set('view engine','ejs');

const mongourl = '';
const dbName = 'project';

const SECRETKEY = 'I want to pass COMPS381F';

const users = new Array(
	{name: 'demo', password: ''},
	{name: 'student', password: ''}
);

app.set('view engine','ejs');

app.use(session({
	name: 'loginSession',
	keys: [SECRETKEY],
	maxAge: 10 * 60 * 1000
}));

// support parsing of application/json type post data
app.use(bodyParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//insert
const insertDocument = (db, doc, callback) => { 
    db.collection('restaurant').insertOne(doc, (err, results) => {
		assert.equal(err,null);
		console.log("inserted one document " + JSON.stringify(doc)); 
		callback(results);
    }); 
}

const handle_Insert = (res, req) => {
	var DOC = 
	{
		"restaurant_id":"",
		"name": req.fields.rname,
		"borough": req.fields.borough,
		"cuisine": req.fields.cuisine,
		"photo":"",
		"address":
		{
			"street": req.fields.street,
			"building": req.fields.building,
			"zipcode": req.fields.zipcode,
			"coord":[req.fields.coord_lon, req.fields.coord_lat]
		},
		"grades":[],
		"owner": req.session.username
	};
	const client = new MongoClient(mongourl);
	client.connect((err) => {
    	assert.equal(null, err);
    	console.log("Connected successfully to server");
    	const db = client.db(dbName);
		//var objectId;
		if (req.files.photo && req.files.photo.size > 0) {
            fs.readFile(req.files.photo.path, (err,data) => {
                assert.equal(err,null);
                DOC['photo'] = new Buffer.from(data).toString('base64');
                insertDocument(db, DOC, (results) => {
            		client.close();
            		console.log("Closed DB connection");
					res.status(200).render('showCreate',{restaurant: DOC, _id: DOC._id});
    			})
            });
		} else {
			insertDocument(db, DOC, (results) => {
            	client.close();
            	console.log("Closed DB connection");
				res.status(200).render('showCreate',{restaurant: DOC, _id: DOC._id});
    		})
		}
    	
    });
}


//search
const findDistinct = (db, title, callback) => {
	db.collection('restaurant').distinct(title, (err,docs) => {
		console.log(docs);
		callback(docs);
	});
}


//list all or some
const findDocument = (db, criteria, callback) => {
	if (criteria != null) {
   		var cursor = db.collection('restaurant').find(criteria, {name: 1});
	}
	else {
		var cursor = db.collection('restaurant').find({}, {name: 1});
	}
	//var cursor = db.collection('restaurant').find(criteria);
    console.log(`findDocument: ${JSON.stringify(criteria)}`);
    cursor.toArray((err,docs) => {
        assert.equal(err,null);
        console.log(`findDocument: ${docs.length}`);
        callback(docs);
    });
}

const handle_Find = (res, criteria, username) => {
	var criterias;
	var showCriteria = {};
	//var criterias = {"name": "default", "borough": "default", "cuisine": "default"};
	
	if(Object.keys(criteria).length === 0){
		criterias = null;
	} else {
		criterias = {}
		if (criteria.name != "default"){
			criterias['name'] = criteria.name;
			showCriteria['name'] = criteria.name;
		} else {
			if (criteria.borough != "default" && criteria.cuisine == "default") {
				criterias['borough'] = criteria.borough;
				showCriteria['borough'] = criteria.borough;
			}
			if (criteria.borough != "default" && criteria.cuisine != "default") {
				criterias = { $or: [ {'borough': criteria.borough}, {'cuisine': criteria.cuisine} ] }
				showCriteria['borough'] = criteria.borough;
				showCriteria['cuisine'] = criteria.cuisine;
			}
		}
	}


	const client = new MongoClient(mongourl);
    	client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server. \ncriteria:" + JSON.stringify(criterias));
        const db = client.db(dbName);
		
		var result = {};
		result['criterias'] = showCriteria;

		findDistinct(db, "name", (docs) => {
			client.close();
           	console.log("Closed DB connection");
			result['names'] = docs;
  		});

		findDistinct(db, "borough", (docs) => {
			client.close();
           	console.log("Closed DB connection");
			result['boroughs'] = docs;
  		});

		findDistinct(db, "cuisine", (docs) => {
			client.close();
           	console.log("Closed DB connection");
			result['cuisines'] = docs;
  		});

        findDocument(db, criterias, (docs) => {
            client.close();
            console.log("Closed DB connection");
			result['name'] = username;
			result['nRestaurant'] = docs.length;
			result['restaurant'] = docs;
            //res.status(200).render('list', {name: username, nRestaurant: docs.length, restaurant: docs});
			res.status(200).render('list', result);
        });
		//res.status(200).render('list', result);
    });
}

//find one
const handle_Details = (res,req, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        findDocument(db, DOCID, (docs) => {  // docs contain 1 document (hopefully)
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('details', {restaurant: docs[0], login_user: req.session.username});
        });
    });
}


//edit
const handle_Edit = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
        let cursor = db.collection('restaurant').find(DOCID);
        cursor.toArray((err,docs) => {
            client.close();
            assert.equal(err,null);
            res.status(200).render('change',{restaurant: docs[0]});
        });
    });
}


//update
const updateDocument = (criteria, updateDoc, callback) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

         db.collection('restaurant').updateOne(criteria,
            {
                $set : updateDoc
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
				console.log("update one document " + JSON.stringify(updateDoc)); 
                callback(results);
            }
        );
    });
}

const handle_Update = (req, res, criteria) => {
    var DOCID = {};
    DOCID['_id'] = ObjectID(req.fields._id);
    var updateDoc = {};
	updateDoc['name'] = req.fields.rname;
	updateDoc['borough'] = req.fields.borough;
	updateDoc['cuisine'] = req.fields.cuisine;
	updateDoc['address'] = 
		{
			"street": req.fields.street,
			"building": req.fields.building,
			"zipcode": req.fields.zipcode,
			"coord":[req.fields.coord_lon, req.fields.coord_lat]
		};

        if (req.files.photo.size > 0) {
            fs.readFile(req.files.photo.path, (err,data) => {
                assert.equal(err,null);
                updateDoc['photo'] = new Buffer.from(data).toString('base64');
                updateDocument(DOCID, updateDoc, (results) => {
					res.redirect('/details?_id=' + DOCID['_id']);
                });
            });
        } else {
            updateDocument(DOCID, updateDoc, (results) => {
				res.redirect('/details?_id=' + DOCID['_id']);
            });
        }
}


//delete one
const deleteDocument = (db, criteria, callback) => {
    db.collection('restaurant').deleteOne(criteria, (err,results) => {
        assert.equal(err,null);
        console.log('Delete was successful');
        console.log(`Deleted documents having criteria ${JSON.stringify(criteria)}: ${results.deletedCount}`);
        callback(results);
    })
}

const handle_Delete = (res, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

		let DOCID = {};
        DOCID['_id'] = ObjectID(criteria._id)
    
        deleteDocument(db, DOCID, (results) => {
            client.close();
            console.log("Closed DB connection");
			res.status(200).render('info', {title: "Delete", header: "Delete Your Restaurant", message: "Delete was successful"});
        });
    });
}



//find rate
const handle_FindRate = (res,req, criteria) => {
    const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

        /* use Document ID for query */
        let CRITERIA = {};
        CRITERIA['_id'] = ObjectID(criteria._id);
		CRITERIA['grades'] = 
			{
				$elemMatch: {user: req.session.username}
			};
        findDocument(db, CRITERIA, (docs) => {  // docs contain 1 document (hopefully)
            client.close();
            console.log("Closed DB connection");
            res.status(200).render('rate', {nUser: docs.length, _id: criteria._id, name: criteria.name});
        });
    });
}


//rate
const handle_Rate = (req, res, criteria) => {
    var DOCID = {};
    DOCID['_id'] = ObjectID(req.fields._id);
    var updateDoc = {};
	const client = new MongoClient(mongourl);
    client.connect((err) => {
        assert.equal(null, err);
        console.log("Connected successfully to server");
        const db = client.db(dbName);

         db.collection('restaurant').updateOne(DOCID,
            {
                $push : {
					grades: {
						user: req.session.username,
						score: req.fields.score
					}
				}
            },
            (err, results) => {
                client.close();
                assert.equal(err, null);
				console.log("update one document " + JSON.stringify(updateDoc));
            }
        );
		res.redirect('/details?_id=' + DOCID['_id']);
    });
}









app.get('/', (req,res) => {
	console.log(req.session);
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
		res.redirect('/read');
	}
});

app.get('/login', (req,res) => {
	res.status(200).render('login',{});
});

app.post('/login', (req,res) => {
	users.forEach((user) => {
		if (user.name == req.fields.username && user.password == req.fields.pwd) {
			// correct user name + password
			// store the following name/value pairs in cookie session
			req.session.authenticated = true;        // 'authenticated': true
			req.session.username = req.fields.username;	 // 'username': req.body.username		
		}
	});
	res.redirect('/');
});

/*
app.get('/signup', (req,res) => {
	res.status(200).render('register',{});
});

app.post('/signup', (req,res) => {
	users.push({name: req.fields.username, password: req.fields.pwd});
	req.session.authenticated = true;        // 'authenticated': true
	req.session.username = req.fields.username;	 // 'username': req.body.username
	res.redirect('/');
});
*/

app.get('/logout', (req,res) => {
	req.session = null;   // clear cookie-session
	res.redirect('/');
});

app.get('/read', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
		handle_Find(res, req.query, req.session.username);
	}
});

app.get('/details', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	handle_Details(res, req, req.query);
	}
});

app.get("/gmap", (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
		res.render("leaflet.ejs", {
			lat:req.query.lat,
			lon:req.query.lon,
			zoom:req.query.zoom ? req.query.zoom : 15
		});
		res.end();
	}
});


app.get('/rate', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
		handle_FindRate(res, req, req.query);
	}
});

app.post('/rating', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	handle_Rate(req, res, req.query);
	}
});


app.get('/new', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	res.status(200).render('new',{});
	}
});

app.post('/create', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	handle_Insert(res, req);
	}
});

app.get('/change', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	handle_Edit(res, req.query);
	}
});

app.post('/update', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	handle_Update(req, res, req.query);
	}
});

app.get('/remove', (req,res) => {
	if (!req.session.authenticated) {    // user not logged in!
		res.redirect('/login');
	} else {
    	handle_Delete(res, req.query);
	}
});





/* READ
curl -X GET http://localhost:8099/api/restaurant/name/name
*/
app.get('/api/restaurant/name/:name', (req,res) => {
    if (req.params.name) {
        let criteria = {};
        criteria['name'] = req.params.name;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing name"});
    }
})

/* READ
curl -X GET http://localhost:8099/api/restaurant/borough/borough
*/
app.get('/api/restaurant/borough/:borough', (req,res) => {
    if (req.params.borough) {
        let criteria = {};
        criteria['borough'] = req.params.borough;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing borough"});
    }
})

/* READ
curl -X GET http://localhost:8099/api/restaurant/cuisine/cuisine
*/
app.get('/api/restaurant/cuisine/:cuisine', (req,res) => {
    if (req.params.cuisine) {
        let criteria = {};
        criteria['cuisine'] = req.params.cuisine;
        const client = new MongoClient(mongourl);
        client.connect((err) => {
            assert.equal(null, err);
            console.log("Connected successfully to server");
            const db = client.db(dbName);

            findDocument(db, criteria, (docs) => {
                client.close();
                console.log("Closed DB connection");
                res.status(200).json(docs);
            });
        });
    } else {
        res.status(500).json({"error": "missing cuisine"});
    }
})

app.listen(app.listen(process.env.PORT || 8099));
