### Version Information
This is an extension of the `Chat-App-Build-2`. It has been introduced in **Chapter 6** of the third section, belonging to the course "Introduction to Manual Testing & QA in Web Development".

In this version, some significant updates have been made to the application. Following is a summary of the changes:
- The issues discovered by running the test cases in the previous task have now been fixed;
- Users can now create and join chat rooms;
- Chat rooms can now have passwords;
- Users can now have profile pictures;
- A profile management section has been introduced where users can change their username, password and profile picture;
- The API has been modified accordingly. Now it requires an `id` parameter.
- There is an additional endpoint in the API, called `send-message` and it takes in a chatroom `id`, a user `token` and message `content`. When a post request is made to this endpoint with the required parameters, it sends a message to the relevant chatroom on behalf of the user to whom the `token` belongs.
