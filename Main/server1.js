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
app.post('/submit_complaint', (req, res) => {
    // Extract data from the form
    const { namein, phnoin, district, pinno, email, ctitle, complaint } = req.body;

    // Get the current timestamp
    const timestamp = new Date();
    const date = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = timestamp.toISOString().split('T')[1].split('.')[0]; // HH:MM:SS

    // Generate a unique complaint number based on the number of complaints already saved
    fs.readFile('complaints_log.csv', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading complaints log:', err);
            return res.status(500).send('Error reading complaints log');
        }

        // If the file is empty, start complaint_no at 1
        const complaints = data.trim().split('\n');
        const complaint_no = complaints.length > 1 ? parseInt(complaints[complaints.length - 1].split(',')[0]) + 1 : 1;

        // Prepare the complaint content to be saved in the complaint file
        const complaintContent = `
        -------------------------------
        Date: ${date}
        Time: ${time}id
        -------------------------------
        \nComplaint No: ${complaint_no}
        Name: ${namein}
        Phone Number: ${phnoin}
        District : ${district}
        PIN Number : ${pinno}
        Email Id: ${email}
        Complaint Title : ${ctitle}
        -------------------------------
        \nParagraph: \n${complaint}
        -------------------------------
        `;

        // Save the complaint in a unique file <complaint_no>.txt
        fs.writeFile(`complaints/${complaint_no}.txt`, complaintContent, (err) => {
            if (err) {
                console.error('Error saving complaint data:', err);
                return res.status(500).send('There was an error saving your complaint.');
            }

            // Log the complaint metadata into the CSV log file
            const logEntry = `\n${complaint_no},${date},${time}`;
            fs.appendFile('complaints_log.csv', logEntry, (err) => {
                if (err) {
                    console.error('Error logging complaint data:', err);
                    return res.status(500).send('There was an error logging your complaint.');
                }

                console.log('Complaint data saved and logged!');
                res.send('Your complaint has been submitted successfully.');
            });
        });
    });
});

// Catch-all route for unknown URLs
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pageNotFound.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
