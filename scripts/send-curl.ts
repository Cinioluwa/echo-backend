const data = {
  from: "contact@echo-ng.com",
  to: "somtochukwuonyema02@gmail.com",
  subject: "Your organization is now on Echo!",
  html: "<p>Hi,</p><p>Great news! Your request to add <strong>Achievers University</strong> has been approved, and the organization is now live on Echo.</p><p>To get started, you and other students can sign up using your university email address (ending in <strong>@achievers.edu.ng</strong>).</p><p><a href=\"https://app.echo-ng.com/signup\">Click here to sign up</a></p><p>Once you log in, you'll be able to:</p><ul><li>Post and view pings (issues or topics) within your university.</li><li>Propose waves (solutions) to help resolve those issues.</li><li>Surge pings and waves to show your support and get them noticed.</li></ul><p>Welcome to Echo!</p><p>— The Echo Team</p>"
};

fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer re_EdNQzfEK_3UBYeNMUMFGukxML3idjtDq4',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
}).then(res => res.json()).then(console.log).catch(console.error);
