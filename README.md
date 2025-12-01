# Madad - Medical Consultation Platform

Madad is a Node.js/Express-based backend application for a medical consultation platform. It provides real-time messaging, doctor-patient consultations, and medical file management using Socket.IO and MongoDB.

## Features

- **User Authentication** - Secure user authentication and authorization
- **Real-time Chat** - Live messaging between users using Socket.IO
- **Consultation Requests** - Manage consultation requests between patients and doctors
- **Doctor Profiles** - Doctor management and profiles
- **File Management** - Upload and manage patient and doctor files
- **Message Management** - Track and manage consultation messages
- **Rating System** - Rate and review consultations
- **Role-based Access Control** - Different access levels for users and doctors
- **File Uploads** - Secure file upload handling with Multer

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5.1.0
- **Real-time Communication**: Socket.IO v4.8.1
- **Database**: MongoDB with Mongoose v8.15.1
- **File Upload**: Multer v2.0.0
- **Authentication**: Firebase & Firebase Admin
- **Validation**: Joi v17.1.1
- **Utilities**: DayJS v1.11.14

## Project Structure

```
Madad/
├── index.js                          # Main application entry point
├── socket.js                         # Socket.IO configuration and event handlers
├── package.json                      # Project dependencies and scripts
├── config/
│   └── db.js                        # MongoDB connection configuration
├── controllers/
│   ├── auth/
│   │   └── auth.controller.js       # Authentication logic
│   ├── chats/
│   │   ├── chat.controller.js       # Chat management
│   │   └── message.controller.js    # Message handling
│   ├── consultations/
│   │   └── consultation.controller.js # Consultation logic
│   ├── doctors/
│   │   └── doctor.controller.js     # Doctor management
│   ├── uploads/
│   │   └── chatUpload.controller.js # File upload handling
│   └── users/
│       └── user.controller.js       # User management
├── middlewares/
│   ├── auth.js                      # HTTP authentication middleware
│   ├── role.js                      # Role-based access control
│   ├── socketAuth.js                # Socket.IO authentication
│   └── upload.js                    # File upload middleware
├── models/
│   ├── chat.model.js                # Chat schema
│   ├── consultation-request.model.js # Consultation request schema
│   ├── doctor.model.js              # Doctor schema
│   ├── message.model.js             # Message schema
│   ├── ratting.model.js             # Rating schema
│   └── user.model.js                # User schema
├── routes/
│   ├── index.js                     # Main routes file
│   ├── auth/
│   │   └── auth.routes.js           # Authentication endpoints
│   ├── chats/
│   │   ├── chat.routes.js           # Chat endpoints
│   │   └── message.routes.js        # Message endpoints
│   ├── consultations/
│   │   └── consultation.routes.js   # Consultation endpoints
│   ├── doctors/
│   │   └── doctor.routes.js         # Doctor endpoints
│   ├── patients/
│   │   └── patient.routes.js        # Patient endpoints
│   ├── uploads/
│   │   └── chatUpload.routes.js     # Upload endpoints
│   └── users/
│       └── user.routes.js           # User endpoints
├── src/
│   ├── firebase.js                  # Firebase configuration
│   └── mdad-test-firebase-adminsdk-fbsvc-a71b032162.json # Firebase credentials
├── uploads/                          # Temporary file uploads
├── patientFiles/                     # Patient document storage
├── doctorFiles/                      # Doctor document storage
├── image/                            # Image storage
└── views/
    └── test-login.html              # Test login page
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Madad
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=<your-mongodb-connection-string>
   FIREBASE_API_KEY=<your-firebase-api-key>
   FIREBASE_AUTH_DOMAIN=<your-firebase-auth-domain>
   FIREBASE_PROJECT_ID=<your-firebase-project-id>
   # Add other required environment variables
   ```

4. **Firebase Setup**
   - Place your Firebase Admin SDK JSON file in the `src/` directory
   - Update the reference in `src/firebase.js` if needed

## Running the Application

### Development Mode
```bash
npm start
```
This starts the server with Nodemon for automatic restart on file changes.

### Production Mode
```bash
node index.js
```

The server will run on the port specified in your `.env` file (default: 5000).

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - User login

### Users
- `GET /api/users` - Get user list
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user profile

### Doctors
- `GET /api/doctors` - Get doctors list
- `GET /api/doctors/:id` - Get doctor details
- `POST /api/doctors` - Create doctor profile

### Consultations
- `GET /api/consultations` - Get consultations
- `POST /api/consultations` - Request consultation
- `PUT /api/consultations/:id` - Update consultation status

### Chats
- `GET /api/chats` - Get user chats
- `POST /api/chats` - Create new chat

### Messages
- `GET /api/messages/:chatId` - Get chat messages
- `POST /api/messages` - Send message

### Uploads
- `POST /api/uploads/chat` - Upload chat file

## Socket.IO Events

The application uses Socket.IO for real-time communication. Key events include:
- `connect` - User connects to socket
- `disconnect` - User disconnects
- `send_message` - Send real-time message
- `receive_message` - Receive real-time message
- `typing` - User typing indicator
- `stop_typing` - Stop typing indicator

## File Upload

Files are managed through Multer with the following storage locations:
- **Patient Files**: `/patientFiles`
- **Doctor Files**: `/doctorFiles`
- **Chat Uploads**: `/uploads`
- **Images**: `/image`

## Database Models

### User
- Basic user information and authentication
- Profile details
- Role assignment

### Doctor
- Doctor profile and specialization
- Availability and consultation rates
- Qualifications

### Chat
- Conversation between users
- Metadata and timestamps

### Message
- Individual messages within chats
- Timestamps and read status

### Consultation Request
- Consultation request details
- Status tracking
- Doctor-patient assignment

### Rating
- User ratings and reviews
- Feedback on consultations

## Middleware

- **auth.js** - HTTP request authentication verification
- **role.js** - Role-based access control (RBAC)
- **socketAuth.js** - Socket.IO connection authentication
- **upload.js** - File upload handling and validation

## Error Handling

The application includes global error handling middleware that:
- Catches all unhandled errors
- Logs error messages
- Returns standardized error responses with HTTP 500 status

## Security Features

- JWT/Firebase authentication
- Role-based access control
- Socket.IO authentication middleware
- CORS enabled for cross-origin requests

## CORS Configuration

Current CORS settings allow all origins:
```javascript
cors: {
  origin: "*",
  methods: ["GET", "POST"]
}
```

**Note**: For production, restrict the origin to your frontend domain.

## Static File Serving

The application serves static files from:
- `/uploads` - Temporary uploads
- `/patientFiles` - Patient documents
- `/doctorFiles` - Doctor documents
- `/image` - Images

## Environment Variables

Create a `.env` file with:
```
PORT=5000
MONGODB_URI=mongodb://...
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## Development Tools

- **Nodemon** - Automatic server restart on file changes
- **Joi** - Data validation
- **DayJS** - Date/time utilities

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please contact the development team or create an issue in the repository.

---

**Note**: This is a backend application. A corresponding frontend application is required to fully utilize this API.
