# CWOC Release 20260504.0821

Fixed signature modal preview text being centered — added text-align:left to the modal content and preview div.

Fixed raw HTML tags showing in the email compose textarea. The signature is now inserted as raw markdown (the way the user wrote it) into the body textarea. The server handles converting markdown to HTML when the email is actually sent. A textarea can only display plain text, so inserting HTML tags was wrong.
