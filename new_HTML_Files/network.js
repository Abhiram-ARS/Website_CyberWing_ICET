const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const nodes = [];
const numNodes = 100;
const maxDistance = 100;

class Node {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.dx = Math.random() * 2 - 1;
        this.dy = Math.random() * 2 - 1;
        this.dz = Math.random() * 2 - 1;
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        this.z += this.dz;

        if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.dy *= -1;
        if (this.z < -500 || this.z > 500) this.dz *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.abs(this.z) / 500 * 2 + 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 0, ${1 - Math.abs(this.z) / 500})`;  // Hackergreen color
        ctx.fill();
    }
}

for (let i = 0; i < numNodes; i++) {
    nodes.push(new Node(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 1000 - 500));
}

function drawLine(x1, y1, x2, y2, opacity) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;  // Hackergreen color for lines
    ctx.stroke();
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    nodes.forEach(node => {
        node.update();
        node.draw();
    });

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const distance = Math.sqrt(
                (nodes[i].x - nodes[j].x) ** 2 +
                (nodes[i].y - nodes[j].y) ** 2 +
                (nodes[i].z - nodes[j].z) ** 2
            );

            if (distance < maxDistance) {
                drawLine(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, 1 - distance / maxDistance);
            }
        }
    }

    requestAnimationFrame(animate);
}

animate();
