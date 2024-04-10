import {
  ForceLink,
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force'
import { useCallback, useEffect, useRef } from 'react'

const color: string[] = [
  '#b81e48',
  '#f06744',
  '#fdbf6f',
  '#fff7b2',
  '#daf09a',
  '#7ecca5',
  '#3585bb',
  '#496aaf',
]

const varStyles: { [variable: string]: string } = {
  person: 'pink',
  publicTypeIndex: 'yellow',
  hospexDocument: 'blue',
  offer: 'red',
}

interface Node extends SimulationNodeDatum {
  id: string
  variables: Set<string>
}

interface Link extends SimulationLinkDatum<Node> {
  source: string
  target: string
  step: number
}

interface InputLink {
  source: string
  target: string
  step: number
}

export const Graph = ({
  links,
  nodes,
}: {
  links: InputLink[]
  nodes: { [id: string]: Set<string> }
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const width = 1200
  const height = 900
  const simulationRef = useRef<Simulation<Node, Link>>()
  const nodesRef = useRef<Node[]>([])
  const linksRef = useRef<Link[]>([])

  const draw = useCallback(() => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height) // Clear the canvas

    // Draw links
    linksRef.current.forEach(link => {
      context.beginPath()
      context.moveTo(
        (link.source as unknown as Node).x! + width / 2,
        (link.source as unknown as Node).y! + height / 2,
      )
      context.lineTo(
        (link.target as unknown as Node).x! + width / 2,
        (link.target as unknown as Node).y! + height / 2,
      )
      context.strokeStyle = color[link.step]
      context.strokeStyle = link.step === 10 ? 'red' : 'gray'
      context.stroke()
    })

    // Draw nodes
    nodesRef.current.forEach(node => {
      context.beginPath()
      context.arc(node.x! + width / 2, node.y! + height / 2, 5, 0, 2 * Math.PI)

      context.fillStyle = 'black'
      for (const variable of node.variables) {
        context.fillStyle = varStyles[variable]
      }

      context.fill()
      context.fillStyle = 'black'
    })
  }, [])

  const update = useCallback(
    (links: InputLink[], vars: { [id: string]: Set<string> }) => {
      const nodes = Object.entries(vars).map(
        ([uri, vars]) =>
          nodesRef.current.find(n => n.id === uri) ?? {
            id: uri,
            variables: vars,
          },
      )

      nodesRef.current = nodes
      linksRef.current = links

      if (!simulationRef.current) return
      simulationRef.current.nodes(nodesRef.current)
      ;(simulationRef.current.force('link')! as ForceLink<Node, Link>).links(
        linksRef.current,
      )
      simulationRef.current.alpha(1).restart().tick()
      // draw() // render now!
    },
    [],
  )

  const tickRef = useRef(false)

  useEffect(() => {
    update(links, nodes)
  }, [links, nodes, update])

  useEffect(() => {
    simulationRef.current = forceSimulation<Node>()
      .force('charge', forceManyBody().strength(-1))
      .force(
        'link',
        forceLink<Node, Link>().id(d => d.id),
      )
      // .force('x', forceX())
      // .force('y', forceY())
      .force('center', forceCenter())
      .on('tick', () => {
        tickRef.current = true
      })

    return () => {
      simulationRef.current?.stop()
    }
  }, [draw])

  const requestRef = useRef<number>()

  const animate = useCallback(() => {
    requestRef.current = requestAnimationFrame(animate)

    if (!tickRef.current) return
    draw()
    tickRef.current = false
  }, [draw])

  useEffect(() => {
    // Start the animation
    requestRef.current = requestAnimationFrame(animate)

    // Cleanup function to cancel the animation frame request when the component unmounts
    return () => cancelAnimationFrame(requestRef.current!)
  }, [animate]) // Empty dependency array means this effect runs once on mount and cleanup on unmount

  return <canvas ref={canvasRef} width={width} height={height} />
}
