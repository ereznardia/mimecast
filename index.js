require('dotenv').config()
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const request = require('request');
const mysql      = require('mysql');
var Q = require('q');

const API_KEY = process.env.API_KEY

// fields can be in .env also 
var connection = mysql.createConnection({
    host     : process.env.DBHOST,
    database : process.env.DATABASE,
    user     : process.env.DBUSER,
    password : process.env.DBPASSWORD
});

// (10 minutes)

app.use(bodyParser.json({ limit: '5000mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '5000mb' }));

app.use(express.urlencoded());
app.use(express.json());

const server = require('http').createServer(app);

server.listen(3000, () => console.log(`Running!`))

app.post('/author', function (req, res) {    
    let author = req.body.author;

    // to support multiple apis
    // i would put this in external file and reference it with require, i would export in the nytimes.js file 2 methods, "create" and "get". 
    // but for now i put it here

    request({
        uri: 'https://api.nytimes.com/svc/books/v3/reviews.json?author='+author+'&api-key='+API_KEY,
        method: 'GET'
    }, function (err, res2, body) {
        let reviews = JSON.parse(body);
        
        // it would be better if they put the author name in the general object, not sure why they put the author name in all of his books array.
        let author_name = connection.escape(reviews.results[0].book_author);

        // (20 minutes)

        // to avoid inserting each book to the books table in a diffrenet query, we can add all books in a single query.         
        // will look like this
/*
        INSERT INTO books (column_list)
        VALUES
            (value_list_1),
            (value_list_2),
            ...
            (value_list_n);
*/

        // for simplicity we build a simple structure and run over it.

        books_dictionary = {};

        for (let i=0;i<reviews.results.length;i++){
            let book_name = reviews.results[i].book_title;
            let summary = reviews.results[i].summary;            
            if (!books_dictionary[book_name]){
                books_dictionary[book_name] = [];
            }
            books_dictionary[book_name].push(summary);
        }

        // (25 minutes)

        connection.query("INSERT INTO authors (name) VALUES (" + author_name + ")", function (error, data) {                
            let book_names = Object.keys(books_dictionary);
            let all_books_string = book_names.map(book => {
                return "(" + connection.escape(book) + "," + author_name + ")"
            });
            
            // (20 minutes)

            connection.query("INSERT INTO books (name,author_name) VALUES " + all_books_string.join(), async function (error, data) {               
                for (let i=0;i<book_names.length;i++){
                    add_reviews([book_names[i]]);
                }  
                res.sendStatus(200);
            }); 

            // (20 minutes)

            function add_reviews(book_name){
                var deferred = Q.defer();
                let summaries = books_dictionary[book_name];
                let all_summaries_string = summaries.map(summary => {
                    return "(" + connection.escape(summary) + "," + connection.escape(book_name) + ")"
                });

                // (20 minutes)

                connection.query("INSERT INTO reviews (summary,book_name) VALUES " + all_summaries_string.join(), function (error, data) {
                    if (error){
                        res.send(error);
                    }
                    else{
                        deferred.resolve();   
                    }
                }); 
                return deferred.promise;
            }

        });              
    });
})


app.get('/author/:author', function (req, res) {  
    // we can later add group_concat to concatenate books reviews toghther.   
    connection.query("SELECT books.name,reviews.summary from books INNER JOIN reviews ON books.name=reviews.book_name WHERE books.author_name="+connection.escape(req.params.author), function (error, data) {
        res.send(data);
    });

    // (20 minutes)
})
