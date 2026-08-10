# fotocode.

🏆 **Won 1st Place** at the **"Capture and Code"** competition conducted at REC on March 10!

---

A demo website created for the competition.
## Step 1: Extract the Project
1. Right-click the `rec-portfolio-to-share.zip` file.
2. Select "Extract All" (Windows) or "Open" (Mac) to uncompress the folder.

## Step 2: Install Node.js (If not already installed)
The project needs **Node.js** to run. 
1. Go to [nodejs.org](https://nodejs.org/).
2. Download and install the version labeled **"LTS"** (Long Term Support).

## Step 3: Open the Terminal
1. **Windows:** Open the folder, type `cmd` in the address bar at the top, and press Enter.
2. **Mac:** Right-click the extracted `rec-portfolio` folder and select "New Terminal at Folder".

## Step 4: Install Dependencies (Crucial)
Since we removed the heavy files to make the zip small, you need to download them back (this is fast).
In the terminal, type this and press Enter:
```bash
npm install
```
*This recreates the `node_modules` folder specifically for their computer.*

## Step 5: Run the Project
Once the installation finishes, type this:
```bash
npm run dev
```

## Step 6: View the Website
Open a web browser (Chrome, Safari, etc.) and go to:
**http://localhost:3000**

---

### Troubleshooting
- **Permission Errors:** If it says "permission denied" on a Mac, try `sudo npm install`.
- **Node Version:** Ensure they have Node.js version 18 or higher.
- **Port Busy:** If it says "port 3000 is in use", they can try `npm run dev -- -p 3001` and go to localhost:3001 instead.