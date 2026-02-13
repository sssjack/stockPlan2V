const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

const connection = mysql.createConnection({
  host: '8.141.121.133',
  user: 'root',
  password: 'chenkexin',
  port: 3306,
  multipleStatements: true
});

const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
  connection.query(sql, (err, result) => {
    if (err) throw err;
    console.log('Database and Tables created/verified.');
    connection.end();
  });
});
