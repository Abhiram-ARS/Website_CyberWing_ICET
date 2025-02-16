const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'webPage_Intro.html'));
});

// Handle the complaints form submission (POST request)
app.post('submit_complaint', (req, res) => {
    // Extract data from the form
    const { column1, column2, column3, column4, column5, column6, paragraph } = req.body;

    // Prepare the data for storage
    const formData = `
    Column 1: ${column1}
    Column 2: ${column2}
    Column 3: ${column3}
    Column 4: ${column4}
    Column 5: ${column5}
    Column 6: ${column6}
    Paragraph: ${paragraph}
    -------------------------------
    `;

    // Append the data to a text file (you can change the file path as needed)
    fs.appendFile('complaints.txt', formData, (err) => {
        if (err) {
            console.error('Error saving complaint data:', err);
            res.status(500).send('There was an error saving your complaint.');
        } else {
            console.log('Complaint data saved!');
            res.send('Your complaint has been submitted successfully.');
        }
    });
});

// Catch-all route for unknown URLs
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pageNotFound.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
