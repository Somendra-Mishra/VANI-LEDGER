"""Optional LangGraph orchestration skeleton; deterministic core remains Python."""
from typing import TypedDict, Any

class VaniState(TypedDict, total=False):
    product_id: int
    intent: str
    validated: bool
    result: dict[str, Any]
    error: str

def build_graph():
    try:
        from langgraph.graph import StateGraph, END
    except ImportError as exc:
        raise RuntimeError('Install langgraph to enable this optional orchestration layer.') from exc
    def validate(state: VaniState):
        pid=state.get('product_id')
        if not isinstance(pid,int) or pid<=0: return {'validated':False,'error':'A positive product_id is required.'}
        return {'validated':True}
    def route(state: VaniState): return 'execute' if state.get('validated') else 'stop'
    def execute(state: VaniState):
        # Business operations are deliberately delegated to typed Python tools/API,
        # not to an LLM-generated arithmetic expression.
        return {'result':{'status':'validated','product_id':state['product_id'],
                          'next_action':'Call forecast_sku_demand via FastMCP or /api/ml/forecast.'}}
    g=StateGraph(VaniState); g.add_node('validate',validate); g.add_node('execute',execute)
    g.set_entry_point('validate'); g.add_conditional_edges('validate',route,{'execute':'execute','stop':END})
    g.add_edge('execute',END); return g.compile()
