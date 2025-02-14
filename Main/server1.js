const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files (like images and CSS)
//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Route to serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'webPage_intro.html'));
});

// Handle form submission
app.post('/', (req, res) => {
    const { column1, column2, column3, column4, column5, column6, paragraph } = req.body;

    // Prepare the data to be written to the text file
    const data = `
    Column 1: ${column1}
    Column 2: ${column2}
    Column 3: ${column3}
    Column 4: ${column4}
    Column 5: ${column5}
    Column 6: ${column6}
    Detailed Paragraph: ${paragraph}
    ----------------------------------------------
    `;

    // Append the data to the file (if the file doesn't exist, it will be created)
    fs.appendFile('formData.txt', data, (err) => {
        if (err) {
            console.error('Error writing to file', err);
            return res.status(500).send('Error saving data.');
        }

        console.log('Form data saved.');
        res.send('Form submitted successfully!');
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
app.use(express.static('public'));
