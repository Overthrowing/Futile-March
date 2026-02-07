from flask import Flask
from flask import send_from_directory


app = Flask(__name__, static_url_path='/', static_folder='bundled/')

@app.route("/")
def index():
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=3000)