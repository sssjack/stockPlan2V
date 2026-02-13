const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: '8.141.121.133',
  user: 'root',
  password: 'chenkexin',
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
