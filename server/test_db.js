const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '0.0.0.0',
  user: 'root',
  password: '0.0.0.0',
  port: 3306
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting: ' + err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
  connection.end();
});
